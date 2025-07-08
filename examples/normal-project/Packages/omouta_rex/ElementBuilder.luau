--!strict

local Types = require('./Types')
local Props = require('./Props')
local ReactiveProps = require('./ReactiveProps')

type RexElement = Types.RexElement
type RexProps = Types.RexProps
type RexChildren = Types.RexChildren
type RexFragment = Types.RexFragment

local ElementBuilder = {}

-- Global registry for reactive bindings
local reactiveBindings: {[Instance]: {() -> ()}} = {}

-- Enhanced element creation with key support
function ElementBuilder.create(className: string, props: RexProps?): RexElement
	local element: RexElement = {
		className = className,
		props = props or {},
		children = nil,
		instance = nil,
		key = nil,
	}
	
	-- Extract key and children from props
	if props then
		element.key = props.key
		local children = props.children or props[Props.Children]
		if children then
			element.children = children
		end
	end
	
	return element
end

-- Create a wrapped element from an existing Roblox instance
function ElementBuilder.createDefinedElement(instanceOrName: Instance | string, props: RexProps?): RexElement
	local element: RexElement = {
		className = "__RexDefined",
		props = props or {},
		children = nil,
		instance = nil,
		key = nil,
		_definedInstance = instanceOrName, -- Store the reference to find or use later
	}
	
	-- Extract key and children from props
	if props then
		element.key = props.key
		local children = props.children or props[Props.Children]
		if children then
			element.children = children
		end
	end
	
	return element
end

-- Create a Fragment (multiple elements without wrapper)
function ElementBuilder.createFragment(children: {RexElement}, key: string?): RexFragment
	return {
		__rexFragment = true,
		children = children,
		key = key,
	}
end

-- Safely destroy an element and clean up its children
function ElementBuilder.destroyElement(element: RexElement): ()
	if not element.instance then
		return
	end
	
	-- First, clean up any reactive bindings for this element
	ElementBuilder.cleanupReactiveBindings(element.instance)
	
	-- If this element has children in our element tree, clean them up first
	if element.children then
		local childrenArray = ElementBuilder.normalizeChildrenToArray(element.children)
		if childrenArray then
			for _, child in ipairs(childrenArray) do
				if child then
					ElementBuilder.destroyElement(child)
				end
			end
		end
	end
	
	-- Finally, destroy the instance (this will also destroy any remaining Roblox children)
	element.instance:Destroy()
	element.instance = nil
end

-- Key-based diffing algorithm
local function createKeyMap(elements: {RexElement}): {[string]: RexElement}
	local keyMap: {[string]: RexElement} = {}
	local usedKeys: {[string]: boolean} = {}
	
	for i, element in ipairs(elements) do
		local key: string = element.key or ("auto_" .. tostring(i))
		
		-- If no explicit key provided, ensure uniqueness
		if not element.key then
			-- Ensure uniqueness by checking for collisions
			local counter = 1
			local originalKey = key
			while usedKeys[key] do
				key = originalKey .. "_" .. tostring(counter)
				counter = counter + 1
			end
		end
		
		-- Check for duplicate explicit keys and warn
		if usedKeys[key] then
			warn(`Rex.ElementBuilder: Duplicate key "{key}" found. This can cause rendering issues. Please ensure all keys are unique.`)
			-- Make it unique anyway
			local counter = 1
			local originalKey = key
			repeat
				key = originalKey .. "_duplicate_" .. tostring(counter)
				counter = counter + 1
			until not usedKeys[key]
		end
		
		usedKeys[key] = true
		keyMap[key] = element
	end
	return keyMap
end

-- Efficient children reconciliation with keys
function ElementBuilder.reconcileChildren(
	parent: Instance,
	oldChildren: {RexElement}?,
	newChildren: {RexElement}?
): ()
	if not newChildren then
		-- Remove all children
		if oldChildren then
			for _, child in ipairs(oldChildren) do
				ElementBuilder.destroyElement(child)
			end
		end
		return
	end
	
	if not oldChildren then
		-- Add all new children (filter out nil elements)
		for _, child in ipairs(newChildren) do
			if child then
				ElementBuilder.instantiate(child, parent)
			end
		end
		return
	end
	
	-- Create key maps for efficient lookup
	local oldKeyMap = createKeyMap(oldChildren)
	local newKeyMap = createKeyMap(newChildren)
	
	-- Track which elements are reused
	local reusedKeys: {[string]: boolean} = {}
	
	-- Phase 1: Update existing elements and mark reused
	for i, newChild in ipairs(newChildren) do
		-- Skip nil children
		if not newChild then
			continue
		end
		
		local key = newChild.key or tostring(i)
		local oldChild = oldKeyMap[key]
		
		if oldChild then
			-- Element exists, update it
			reusedKeys[key] = true
			if oldChild.instance and ElementBuilder.areCompatible(oldChild, newChild) then
				-- Compatible elements - update in place
				newChild.instance = oldChild.instance
				ElementBuilder.updateInstance(oldChild.instance, oldChild.props, newChild.props)
				
				-- Recursively update children
				if newChild.children and oldChild.children then
					local oldChildrenArray = ElementBuilder.normalizeChildrenToArray(oldChild.children)
					local newChildrenArray = ElementBuilder.normalizeChildrenToArray(newChild.children)
					ElementBuilder.reconcileChildren(oldChild.instance, oldChildrenArray, newChildrenArray)
				end
			else
				-- Incompatible elements - replace
				ElementBuilder.destroyElement(oldChild)
				ElementBuilder.instantiate(newChild, parent)
			end
		else
			-- New element - create it
			ElementBuilder.instantiate(newChild, parent)
		end
	end
	
	-- Phase 2: Remove elements that are no longer needed
	for key, oldChild in pairs(oldKeyMap) do
		if not reusedKeys[key] then
			ElementBuilder.destroyElement(oldChild)
		end
	end
	
	-- Phase 3: Reorder elements to match new order (skip if there are layout objects)
	local hasLayoutObjects = false
	for _, child in ipairs(newChildren) do
		if child.instance then
			local className = child.instance.ClassName
			if className == "UIListLayout" or className == "UIGridLayout" or className == "UIPageLayout" or
			   className == "UITableLayout" or className:find("Constraint") then
				hasLayoutObjects = true
				break
			end
		end
	end
	
	if not hasLayoutObjects then
		ElementBuilder.reorderChildren(parent, newChildren)
	end
end

-- Reorder children to match the desired order
function ElementBuilder.reorderChildren(parent: Instance, children: {RexElement}): ()
	for i, child in ipairs(children) do
		if child.instance and child.instance.Parent ~= parent then
			-- Only reparent if the instance isn't already in the correct parent
			-- Skip certain UI objects that have reparenting restrictions
			local className = child.instance.ClassName
			if className == "UIListLayout" or className == "UIGridLayout" or className == "UIPageLayout" or
			   className == "UITableLayout" or className:find("Constraint") then
				-- These objects have special reparenting rules - only reparent if absolutely necessary
				if child.instance.Parent == nil then
					child.instance.Parent = parent
				end
			else
				-- Safe to reparent for normal UI elements
				child.instance.Parent = parent
			end
		end
	end
end

-- Normalize children to array format for diffing
function ElementBuilder.normalizeChildrenToArray(children: RexChildren): {RexElement}?
	if not children then
		return nil
	end
	
	if typeof(children) == "table" then
		-- Check if it's a fragment
		if (children :: any).__rexFragment then
			return (children :: RexFragment).children
		end
		
		-- Check if it's a single element
		if (children :: any).className then
			return {children :: RexElement}
		end
		
		-- Check if it's a reactive state object
		if ElementBuilder.isRexState(children) then
			-- For reactive state, we need to get the current value
			local currentValue = (children :: any):get()
			return ElementBuilder.normalizeChildrenToArray(currentValue)
		end
		
		-- Check if it's a reactive children object
		if ElementBuilder.isReactiveChildren(children) then
			local currentValue = (children :: any).get()
			return ElementBuilder.normalizeChildrenToArray(currentValue)
		end
		
		-- It's an array - check each element and expand reactive ones
		local normalizedArray = {}
		for _, child in ipairs(children :: {any}) do
			if child then
				if ElementBuilder.isRexState(child) or ElementBuilder.isReactiveChildren(child) then
					-- This is a reactive child in a mixed array - we can't handle this statically
					-- Return nil to indicate this needs special reactive handling
					return nil
				elseif typeof(child) == "table" and (child :: any).className then
					-- Regular RexElement
					table.insert(normalizedArray, child)
				end
			end
		end
		
		return normalizedArray
	end
	
	return nil
end

-- Enhanced instantiation with fragment support
function ElementBuilder.instantiate(element: RexElement | RexFragment, parent: Instance?): Instance?
	-- Handle nil elements
	if not element then
		warn("Rex.ElementBuilder: Attempted to instantiate nil element. This usually happens when a component returns nil or when accessing undefined variables.\n" ..
			"📖 Learn more: https://rex.tigas.dev/docs/0.2.0/core_concepts/components\n" ..
			"💡 Tip: Check that your component functions return valid RexElement objects, and that all variables are properly defined.")
		return nil
	end
	
	-- Handle fragments
	if typeof(element) == "table" and (element :: any).__rexFragment then
		local fragment = element :: RexFragment
		for _, child in ipairs(fragment.children) do
			ElementBuilder.instantiate(child, parent)
		end
		return nil -- Fragments don't have instances
	end
	
	local rexElement = element :: RexElement
	
	local instance: Instance
	
	-- Handle defined elements (Rex.define()) - check this FIRST before validation
	if rexElement.className == "__RexDefined" and rexElement._definedInstance then
		if typeof(rexElement._definedInstance) == "Instance" then
			-- Direct instance reference
			instance = rexElement._definedInstance :: Instance
		elseif typeof(rexElement._definedInstance) == "string" then
			-- String name - find in parent
			if not parent then
				error(`Rex.define: Cannot find child "{rexElement._definedInstance}" because no parent context is available.\n` ..
					"📖 Learn more: https://rex.tigas.dev/docs/0.2.0/api_reference/define\n" ..
					"💡 Tip: When using Rex.define with string names, ensure the element is used within a parent that contains the named child.")
			end
			
			local childInstance = parent:FindFirstChild(rexElement._definedInstance :: string)
			if not childInstance then
				error(`Rex.define: Child "{rexElement._definedInstance}" not found in parent "{parent.Name}".\n` ..
					"📖 Learn more: https://rex.tigas.dev/docs/0.2.0/api_reference/define\n" ..
					"💡 Tip: Check that the child name is spelled correctly and exists in the parent Instance.\n" ..
					`💡 Available children: {table.concat(ElementBuilder.getChildNames(parent), ", ")}`)
			end
			
			instance = childInstance
		else
			error(`Rex.define: Invalid instance type. Expected Instance or string, got {typeof(rexElement._definedInstance)}.\n` ..
				"📖 Learn more: https://rex.tigas.dev/docs/0.2.0/api_reference/define\n" ..
				"💡 Example: Rex.define(instance) or Rex.define('ChildName')")
		end
	elseif rexElement.className == "__RexDefined" then
		-- Defined element without instance reference - this is an error
		error("Rex.define: Element marked as defined but no instance reference found. This is likely an internal error.\n" ..
			"📖 Learn more: https://rex.tigas.dev/docs/0.2.0/api_reference/define\n" ..
			"💡 Tip: Please report this as a bug if you encounter it.")
	else
		-- Regular element creation
		-- Validate className
		if not rexElement.className or rexElement.className == "" then
			warn(`Rex.ElementBuilder: Invalid className: "{rexElement.className}". Elements must have a valid Roblox class name.\n` ..
				"📖 Learn more: https://rex.tigas.dev/docs/0.2.0/core_concepts/components#element-creation\n" ..
				"💡 Tip: Use valid Roblox Instance class names like 'Frame', 'TextLabel', 'TextButton', etc.\n" ..
				"💡 Example: Rex('Frame') { ... } instead of Rex('') { ... }")
			return nil
		end
		
		-- Create the instance
		local success, result = pcall(function()
			return Instance.new(rexElement.className)
		end)
		if not success then
			error(`Rex.ElementBuilder: Failed to create instance of class "{rexElement.className}". This class name is not a valid Roblox Instance type.\n` ..
				"📖 Learn more: https://rex.tigas.dev/docs/0.2.0/core_concepts/components#element-creation\n" ..
				`💡 Error details: {result}\n` ..
				"💡 Tip: Check the Roblox documentation for valid Instance class names, or verify the spelling and capitalization.\n" ..
				"💡 Common classes: Frame, TextLabel, TextButton, ImageLabel, ScrollingFrame, UIListLayout, etc.")
		end
		
		instance = result
	end
	
	-- Apply properties
	ElementBuilder.applyProps(instance, rexElement.props)
	
	-- Handle children with enhanced diffing
	local children = rexElement.children or rexElement.props.children or rexElement.props[Props.Children]
	if children then
		-- Resolve any defined children references before processing
		children = ElementBuilder.resolveDefinedChildren(children, instance)
		
		-- Check if children need reactive handling
		if ElementBuilder.isReactiveChildren(children) then
			ElementBuilder.setupReactiveChildren(instance, children)
		elseif ElementBuilder.isRexState(children) then
			ElementBuilder.setupReactiveStateChildren(instance, children)
		elseif typeof(children) == "table" and ElementBuilder.hasMixedReactiveChildren(children) then
			-- Handle mixed static + reactive children
			ElementBuilder.setupMixedReactiveChildren(instance, children)
		else
			-- Handle static children with diffing
			local childrenArray = ElementBuilder.normalizeChildrenToArray(children)
			if childrenArray then
				ElementBuilder.reconcileChildren(instance, nil, childrenArray)
			end
		end
	end
	
	-- Set parent (but not for defined instances that already have the correct parent)
	if parent and (rexElement.className ~= "__RexDefined" or instance.Parent ~= parent) then
		-- For defined instances, only reparent if necessary to avoid unnecessary moves
		if rexElement.className == "__RexDefined" and instance.Parent and instance.Parent ~= parent then
			warn(`Rex.define: Reparenting defined instance "{instance.Name}" from "{instance.Parent.Name}" to "{parent.Name}". ` ..
				"This may cause visual glitches. Consider organizing your UI hierarchy to avoid reparenting defined instances.")
		end
		instance.Parent = parent
	end
	
	-- Store reference
	rexElement.instance = instance
	
	return instance
end

-- Enhanced property application with universal reactive handling
function ElementBuilder.applyProps(instance: Instance, props: RexProps): ()
	-- Use the new universal reactive system
	ReactiveProps.applyProps(instance, props)
end

function ElementBuilder.areCompatible(oldElement: RexElement, newElement: RexElement): boolean
	-- For defined elements, check if they reference the same instance
	if oldElement.className == "__RexDefined" and newElement.className == "__RexDefined" then
		return oldElement._definedInstance == newElement._definedInstance
	end
	
	-- For regular elements, check className and key
	return oldElement.className == newElement.className and oldElement.key == newElement.key
end

function ElementBuilder.updateInstance(instance: Instance, oldProps: RexProps, newProps: RexProps): ()
	-- Clean up old reactive bindings
	ReactiveProps.cleanupInstance(instance)
	-- Apply new props with universal reactive system
	ReactiveProps.applyProps(instance, newProps)
end

-- Check if an array has mixed static and reactive children
function ElementBuilder.hasMixedReactiveChildren(children: any): boolean
	if typeof(children) ~= "table" then
		return false
	end
	
	local hasStatic = false
	local hasReactive = false
	
	for _, child in ipairs(children :: {any}) do
		if child then
			if ElementBuilder.isRexState(child) or ElementBuilder.isReactiveChildren(child) then
				hasReactive = true
			elseif typeof(child) == "table" and (child :: any).className then
				hasStatic = true
			end
		end
	end
	
	return hasStatic and hasReactive
end

-- Setup mixed reactive children (static + reactive elements in same array)
function ElementBuilder.setupMixedReactiveChildren(instance: Instance, mixedChildren: any): ()
	if not reactiveBindings[instance] then
		reactiveBindings[instance] = {}
	end
	
	local currentChildren: {RexElement} = {}
	
	local function updateChildren()
		local expandedChildren = {}
		
		-- Process each child in the mixed array
		for _, child in ipairs(mixedChildren :: {any}) do
			if child then
				if ElementBuilder.isRexState(child) or ElementBuilder.isReactiveChildren(child) then
					-- Reactive child - get current value and expand
					local reactiveValue = if ElementBuilder.isRexState(child) then child:get() else child.get()
					local normalized = ElementBuilder.normalizeChildrenToArray(reactiveValue)
					if normalized then
						for _, expandedChild in ipairs(normalized) do
							table.insert(expandedChildren, expandedChild)
						end
					end
				elseif typeof(child) == "table" and (child :: any).className then
					-- Static child - add directly
					table.insert(expandedChildren, child)
				end
			end
		end
		
		-- Use enhanced reconciliation
		ElementBuilder.reconcileChildren(instance, currentChildren, expandedChildren)
		currentChildren = expandedChildren
	end
	
	-- Initial render
	updateChildren()
	
	-- Set up reactive updates for reactive children only
	for _, child in ipairs(mixedChildren :: {any}) do
		if child and (ElementBuilder.isRexState(child) or ElementBuilder.isReactiveChildren(child)) then
			local disconnect = if ElementBuilder.isRexState(child) 
				then child:onChange(updateChildren)
				else child.onChange(updateChildren)
			table.insert(reactiveBindings[instance], disconnect)
		end
	end
end

-- Keep existing reactive functionality
function ElementBuilder.isRexState(value: any): boolean
	return typeof(value) == "table" 
		and typeof(value.get) == "function"
		and typeof(value.set) == "function"
		and typeof(value.onChange) == "function"
end

function ElementBuilder.isReactiveChildren(value: any): boolean
	return typeof(value) == "table" 
		and value.__rexReactiveChildren == true
		and typeof(value.get) == "function"
		and typeof(value.onChange) == "function"
end

function ElementBuilder.setupReactiveBinding(instance: Instance, propertyName: string, state: any): ()
	if not reactiveBindings[instance] then
		reactiveBindings[instance] = {}
	end
	
	local disconnect = state:onChange(function(newValue: any)
		Props.setProperty(instance, propertyName, newValue)
	end)
	
	table.insert(reactiveBindings[instance], disconnect)
	
	-- Clean up when instance is destroyed
	local connection
	connection = instance.AncestryChanged:Connect(function()
		if not instance.Parent then
			ElementBuilder.cleanupReactiveBindings(instance)
			connection:Disconnect()
		end
	end)
end

function ElementBuilder.setupReactiveChildren(instance: Instance, reactiveChildren: any): ()
	if not reactiveBindings[instance] then
		reactiveBindings[instance] = {}
	end
	
	local currentChildren: {RexElement} = {}
	
	local function updateChildren()
		local newChildrenData = reactiveChildren.get()
		local newChildren = ElementBuilder.normalizeChildrenToArray(newChildrenData)
		
		-- Use enhanced reconciliation
		ElementBuilder.reconcileChildren(instance, currentChildren, newChildren)
		currentChildren = newChildren or {}
	end
	
	-- Initial render
	updateChildren()
	
	-- Set up reactive updates
	local disconnect = reactiveChildren.onChange(updateChildren)
	table.insert(reactiveBindings[instance], disconnect)
end

function ElementBuilder.setupReactiveStateChildren(instance: Instance, childrenState: any): ()
	if not reactiveBindings[instance] then
		reactiveBindings[instance] = {}
	end
	
	local currentChildren: {RexElement} = {}
	
	local function updateChildren()
		local newChildrenData = childrenState:get()
		local newChildren = ElementBuilder.normalizeChildrenToArray(newChildrenData)
		
		-- Use enhanced reconciliation
		ElementBuilder.reconcileChildren(instance, currentChildren, newChildren)
		currentChildren = newChildren or {}
	end
	
	-- Initial render
	updateChildren()
	
	-- Set up reactive updates
	local disconnect = childrenState:onChange(updateChildren)
	table.insert(reactiveBindings[instance], disconnect)
end

function ElementBuilder.cleanupReactiveBindings(instance: Instance): ()
	local disconnects = reactiveBindings[instance]
	if disconnects then
		for _, disconnect in ipairs(disconnects) do
			disconnect()
		end
		reactiveBindings[instance] = nil
	end
end

-- Resolve defined children references to actual elements
function ElementBuilder.resolveDefinedChildren(children: RexChildren, parentInstance: Instance): RexChildren
	if not children then
		return nil
	end
	
	-- IMPORTANT: Check for reactive objects first, before treating as regular arrays
	-- If it's a reactive children object (from items:each), return as-is
	if typeof(children) == "table" and (children :: any).__rexReactiveChildren == true then
		return children
	end
	
	-- If it's a reactive state object, return as-is
	if ElementBuilder.isRexState(children) then
		return children
	end
	
	-- Handle single element
	if typeof(children) == "table" and (children :: any).className then
		local element = children :: RexElement
		if element.className == "__RexDefined" and typeof(element._definedInstance) == "string" then
			-- Resolve string reference to actual instance
			local childInstance = parentInstance:FindFirstChild(element._definedInstance :: string)
			if childInstance then
				-- Create a copy with resolved instance
				local resolvedElement: RexElement = {
					className = "__RexDefined",
					props = element.props,
					children = element.children,
					instance = nil,
					key = element.key,
					_definedInstance = childInstance,
				}
				return resolvedElement
			end
		end
		return element
	end
	
	-- Handle array of children (only if it's actually a plain array)
	if typeof(children) == "table" and not (children :: any).className then
		local resolvedChildren: {RexElement} = {}
		for i, child in ipairs(children :: {any}) do
			if child then
				local resolved = ElementBuilder.resolveDefinedChildren(child, parentInstance)
				if resolved then
					resolvedChildren[i] = resolved :: RexElement
				end
			end
		end
		return resolvedChildren
	end
	
	-- Return as-is for other types (reactive states, etc.)
	return children
end

-- Helper function to get child names for error messages
function ElementBuilder.getChildNames(parent: Instance): {string}
	local names = {}
	for _, child in pairs(parent:GetChildren()) do
		table.insert(names, child.Name)
	end
	return names
end

return ElementBuilder

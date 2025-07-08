--!strict

local Types = require('./Types')
local ElementBuilder = require('./ElementBuilder')
local Props = require('./Props')

type RexElement = Types.RexElement
type RenderResult = Types.RenderResult
type RexProps = Types.RexProps

local Renderer = {}

-- Render a Rex element to a container
function Renderer.render(element: RexElement, container: Instance): Instance
	local instance = ElementBuilder.instantiate(element, container)
	if not instance then
		error("Rex.Renderer: Failed to render element. This usually happens when the element has an invalid className or the element is nil.\n" ..
			"📖 Learn more: https://rex.tigas.dev/docs/0.2.0/api_reference/rendering#render\n" ..
			`💡 Check that your element has a valid Roblox class name. Got element: {element and element.className or "nil"}`)
	end
	return instance
end

-- Mount a Rex element tree (creates instances and returns cleanup)
function Renderer.mount(element: RexElement, container: Instance): RenderResult
	local instance = ElementBuilder.instantiate(element, container)
	if not instance then
		error("Rex.Renderer: Failed to mount element. This usually happens when the element has an invalid className or the element is nil.\n" ..
			"📖 Learn more: https://rex.tigas.dev/docs/0.2.0/api_reference/rendering#mount\n" ..
			`💡 Check that your element has a valid Roblox class name. Got element: {element and element.className or "nil"}`)
	end
	
	local cleanup = function()
		if instance and instance.Parent then
			instance:Destroy()
		end
	end
	
	return {
		instance = instance,
		cleanup = cleanup,
	}
end

-- Unmount a rendered element
function Renderer.unmount(renderResult: RenderResult): ()
	renderResult.cleanup()
end

-- Virtual DOM reconciliation with proper diffing
function Renderer.reconcile(oldElement: RexElement?, newElement: RexElement, container: Instance): Instance	-- If no old element, create new one
	if not oldElement then
		local instance = ElementBuilder.instantiate(newElement, container)
		if not instance then
			error("Rex.Renderer: Failed to create new element during reconciliation. This usually happens when the element has an invalid className.\n" ..
				"📖 Learn more: https://rex.tigas.dev/docs/0.2.0/core_concepts/reactivity#virtual-dom-reconciliation\n" ..
				`💡 Check that your element has a valid Roblox class name. Got element: {newElement and newElement.className or "nil"}`)
		end
		return instance
	end
	
	-- If elements are compatible, update in place
	if ElementBuilder.areCompatible(oldElement, newElement) and oldElement.instance then
		-- Reuse the existing instance
		newElement.instance = oldElement.instance
		
		-- Update properties efficiently
		Renderer.updateProperties(oldElement.instance, oldElement.props, newElement.props)
		
		-- Reconcile children recursively
		Renderer.reconcileChildren(oldElement.children, newElement.children, oldElement.instance)
		
		return oldElement.instance	else
		-- Elements are not compatible, replace entirely
		local newInstance = ElementBuilder.instantiate(newElement, container)
		if not newInstance then
			error("Rex.Renderer: Failed to create replacement element during reconciliation. This usually happens when the element has an invalid className.\n" ..
				"📖 Learn more: https://rex.tigas.dev/docs/0.2.0/core_concepts/reactivity#virtual-dom-reconciliation\n" ..
				`💡 Check that your element has a valid Roblox class name. Got element: {newElement and newElement.className or "nil"}`)
		end
		
		-- Clean up old element
		if oldElement.instance then
			ElementBuilder.cleanupReactiveBindings(oldElement.instance)
			oldElement.instance:Destroy()
		end
		
		return newInstance
	end
end

-- Reconcile children arrays with efficient diffing
function Renderer.reconcileChildren(oldChildren: Types.RexChildren, newChildren: Types.RexChildren, parent: Instance): ()
	-- If no new children, destroy all old children
	if not newChildren then
		if oldChildren then
			Renderer.destroyChildren(oldChildren)
		end
		return
	end
		-- If no old children, create all new children
	if not oldChildren then
		local newChildrenArray = Renderer.normalizeChildren(newChildren)
		for _, child in ipairs(newChildrenArray) do
			ElementBuilder.instantiate(child, parent)
		end
		return
	end
	
	-- Normalize children to arrays for consistent processing
	local oldChildrenArray = Renderer.normalizeChildren(oldChildren)
	local newChildrenArray = Renderer.normalizeChildren(newChildren)
	
	-- Perform list reconciliation
	Renderer.reconcileChildList(oldChildrenArray, newChildrenArray, parent)
end

-- Normalize children to consistent array format, flattening nested arrays
function Renderer.normalizeChildren(children: Types.RexChildren): {RexElement}
	if not children then
		return {}
	end
	
	if typeof(children) == "table" then
		if (children :: any).className then
			-- Single child element
			return {children :: RexElement}
		else
			-- Array of children - need to flatten nested arrays
			local flattened = {}
			for _, child in ipairs(children :: {any}) do
				if typeof(child) == "table" then
					if child.className then
						-- Direct Rex element
						table.insert(flattened, child :: RexElement)
					else
						-- Nested array - recursively flatten
						local nestedFlattened = Renderer.normalizeChildren(child)
						for _, nestedChild in ipairs(nestedFlattened) do
							table.insert(flattened, nestedChild)
						end
					end
				end
			end
			return flattened
		end
	end
	
	return {}
end

-- Efficient list reconciliation algorithm
function Renderer.reconcileChildList(oldChildren: {RexElement}, newChildren: {RexElement}, parent: Instance): ()
	local oldLength = #oldChildren
	local newLength = #newChildren
	local maxLength = math.max(oldLength, newLength)
	
	-- Process all positions
	for i = 1, maxLength do
		local oldChild = oldChildren[i]
		local newChild = newChildren[i]
		
		if oldChild and newChild then
			-- Both exist - reconcile
			Renderer.reconcile(oldChild, newChild, parent)
		elseif newChild then
			-- New child added
			ElementBuilder.instantiate(newChild, parent)
		elseif oldChild then
			-- Old child removed
			if oldChild.instance then
				ElementBuilder.cleanupReactiveBindings(oldChild.instance)
				oldChild.instance:Destroy()
			end
		end
	end
end

-- Efficiently update properties between old and new props
function Renderer.updateProperties(instance: Instance, oldProps: RexProps, newProps: RexProps): ()
	local allKeys = {}
	
	-- Collect all unique keys from both old and new props
	for key in pairs(oldProps) do
		allKeys[key] = true
	end
	for key in pairs(newProps) do
		allKeys[key] = true
	end
	
	-- Process each property
	for key in pairs(allKeys) do
		local oldValue = oldProps[key]
		local newValue = newProps[key]
		
		-- Skip if values are the same
		if oldValue == newValue then
			continue
		end
		
		-- Handle property changes
		if Props.isSpecialProp(key) then
			if key == Props.Children then
				-- Children are handled separately
				continue
			elseif key == Props.Ref then
				-- Update ref if it exists
				if typeof(newValue) == "table" then
					newValue.current = instance
				end
			end
		elseif Props.isPropHelper(newValue) then
			-- Apply new prop helper
			newValue.apply(instance)
		elseif typeof(key) == "string" then
			-- Handle reactive state changes
			if ElementBuilder.isRexState(newValue) then
				-- Clean up old reactive binding if it was also a state
				if ElementBuilder.isRexState(oldValue) then
					-- We should clean up the old binding, but for simplicity
					-- we'll let the instance cleanup handle it
				end
						-- Set new value and setup reactive binding
				Props.setProperty(instance, key, newValue:get())
				ElementBuilder.setupReactiveBinding(instance, key, newValue)			else
				-- Set regular property
				Props.setProperty(instance, key, newValue)
			end
		end
	end
end

-- Destroy children elements
function Renderer.destroyChildren(children: Types.RexChildren): ()
	if not children then
		return
	end
	
	if typeof(children) == "table" then
		if (children :: any).className then
			-- Single child
			local child = children :: RexElement
			if child.instance then
				child.instance:Destroy()
			end
		else
			-- Array of children
			for _, child in ipairs(children :: {RexElement}) do
				if child.instance then
					child.instance:Destroy()
				end
			end
		end
	end
end

-- Batch multiple renders for performance
function Renderer.batch(renderFn: () -> ()): ()
	-- In a more sophisticated implementation, this could defer rendering
	-- until the end of the frame or batch multiple state updates
	renderFn()
end

-- Create a reactive renderer that updates when state changes
function Renderer.createReactiveRenderer(renderFn: () -> RexElement, container: Instance): () -> ()
	local currentElement: RexElement? = nil
	local mountedInstance: Instance? = nil
	
	local function rerender()
		local newElement = renderFn()
		
		if currentElement and mountedInstance then
			-- Use reconciliation to efficiently update
			mountedInstance = Renderer.reconcile(currentElement, newElement, container)
		else
			-- Initial render
			mountedInstance = ElementBuilder.instantiate(newElement, container)
		end
		
		currentElement = newElement
	end
	
	-- Initial render
	rerender()
	
	-- Return cleanup function
	return function()
		if mountedInstance then
			ElementBuilder.cleanupReactiveBindings(mountedInstance)
			mountedInstance:Destroy()
		end
	end
end

-- Advanced render method with reconciliation support
function Renderer.renderWithReconciliation(element: RexElement, container: Instance, previousElement: RexElement?): Instance
	if previousElement then
		return Renderer.reconcile(previousElement, element, container)
	else
		local instance = ElementBuilder.instantiate(element, container)
		if not instance then
			error("Rex.Renderer: Failed to render element with reconciliation. This usually happens when the element has an invalid className.\n" ..
				"📖 Learn more: https://rex.tigas.dev/docs/0.2.0/api_reference/rendering#renderwithreconciliation\n" ..
				`💡 Check that your element has a valid Roblox class name. Got element: {element and element.className or "nil"}`)
		end
		return instance
	end
end

-- Create a stateful renderer that can be updated
function Renderer.createStatefulRenderer(initialElement: RexElement, container: Instance): {
	update: (newElement: RexElement) -> (),
	destroy: () -> (),
	getInstance: () -> Instance?
}
	local currentElement = initialElement
	local currentInstance: Instance? = ElementBuilder.instantiate(initialElement, container)
	
	local renderer = {
		update = function(newElement: RexElement)
			if currentInstance then
				currentInstance = Renderer.reconcile(currentElement, newElement, container)
				currentElement = newElement
			end
		end,
		
		destroy = function()
			if currentInstance then
				ElementBuilder.cleanupReactiveBindings(currentInstance)
				currentInstance:Destroy()
				currentInstance = nil
			end
		end,
		
		getInstance = function(): Instance?
			return currentInstance
		end
	}
	
	return renderer
end

return Renderer

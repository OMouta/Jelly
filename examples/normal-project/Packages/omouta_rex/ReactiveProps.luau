--!strict
--[[
	UniversalReactive - Universal Reactive Property Handler
	Handles all reactive property bindings with auto-conversion
	Part of the Rex Framework Universal Reactivity redesign
--]]

local TypeCasting = require('./TypeCasting')
local Reactivity = require('./Reactivity')
local Props = require('./Props')

local UniversalReactive = {}

-- Registry for reactive bindings cleanup
local reactiveBindings: {[Instance]: {() -> ()}} = {}

--[[
	Sets up universal reactive property handling
	Automatically detects reactive values and sets up bindings with auto-conversion
	@param instance The Roblox instance to apply the property to
	@param propertyName The name of the property
	@param value The value to bind (can be reactive or static)
--]]
function UniversalReactive.setupProperty(instance: Instance, propertyName: string, value: any): ()
	-- Skip special props
	if Props.isSpecialProp(propertyName) then
		return
	end
	
	if Reactivity.isReactive(value) then
		-- Handle reactive value
		UniversalReactive.setupReactiveProperty(instance, propertyName, value)
	else
		-- Handle static value with auto-conversion
		UniversalReactive.setStaticProperty(instance, propertyName, value)
	end
end

--[[
	Sets up a reactive property binding
	@param instance The Roblox instance
	@param propertyName The property name
	@param reactiveValue The reactive value to bind
--]]
function UniversalReactive.setupReactiveProperty(instance: Instance, propertyName: string, reactiveValue: any): ()
	-- Set initial value with auto-conversion
	local initialValue = Reactivity.resolveValue(reactiveValue)
	UniversalReactive.setStaticProperty(instance, propertyName, initialValue)
	
	-- Set up reactive binding
	local disconnect = Reactivity.onChange(reactiveValue, function(newValue: any, oldValue: any?)
		UniversalReactive.setStaticProperty(instance, propertyName, newValue)
	end)
	
	-- Register cleanup
	UniversalReactive.registerCleanup(instance, disconnect)
end

--[[
	Sets a static property with auto-conversion
	@param instance The Roblox instance
	@param propertyName The property name
	@param value The static value to set
--]]
function UniversalReactive.setStaticProperty(instance: Instance, propertyName: string, value: any): ()
	-- Apply auto-conversion
	local convertedValue = TypeCasting.autoConvert(value, propertyName)
	
	-- Set the property using Props.setProperty for error handling
	Props.setProperty(instance, propertyName, convertedValue)
end

--[[
	Registers a cleanup function for an instance
	@param instance The instance to register cleanup for
	@param cleanup The cleanup function
--]]
function UniversalReactive.registerCleanup(instance: Instance, cleanup: () -> ()): ()
	if not reactiveBindings[instance] then
		reactiveBindings[instance] = {}
		
		-- Set up automatic cleanup when instance is destroyed
		local connection
		connection = instance.AncestryChanged:Connect(function()
			if not instance.Parent then
				UniversalReactive.cleanupInstance(instance)
				connection:Disconnect()
			end
		end)
	end
	
	table.insert(reactiveBindings[instance], cleanup)
end

--[[
	Cleans up all reactive bindings for an instance
	@param instance The instance to clean up
--]]
function UniversalReactive.cleanupInstance(instance: Instance): ()
	local bindings = reactiveBindings[instance]
	if bindings then
		for _, cleanup in ipairs(bindings) do
			cleanup()
		end
		reactiveBindings[instance] = nil
	end
end

--[[
	Applies all properties to an instance using universal reactive handling
	@param instance The Roblox instance
	@param props The properties table
--]]
function UniversalReactive.applyProps(instance: Instance, props: {[any]: any}): ()
	for key, value in pairs(props) do
		if typeof(key) == "string" then
			-- Handle regular properties
			if key == "children" then
				-- Children are handled separately
				continue
			elseif key == "key" then
				-- Skip key prop - it's for virtual element reconciliation only
				continue
			elseif Props.isEventProp(key) then
				-- Handle events
				Props.setupEventHandler(instance, key, value)
			else
				-- Handle regular properties with universal reactive system
				UniversalReactive.setupProperty(instance, key, value)
			end
		elseif Props.isSpecialProp(key) then
			-- Handle special Rex properties
			if key == Props.Ref then
				if typeof(value) == "table" and value.current ~= nil then
					value.current = instance
				end
			end
		end
	end
end

--[[
	Debug function to get information about reactive bindings
	@param instance The instance to inspect
	@return Debug information about bindings
--]]
function UniversalReactive.getDebugInfo(instance: Instance): {bindingCount: number, hasBindings: boolean}
	local bindings = reactiveBindings[instance]
	return {
		bindingCount = bindings and #bindings or 0,
		hasBindings = bindings ~= nil,
	}
end

--[[
	Updates a reactive property (useful for external updates)
	@param instance The instance
	@param propertyName The property name
	@param newValue The new value
--]]
function UniversalReactive.updateProperty(instance: Instance, propertyName: string, newValue: any): ()
	UniversalReactive.setStaticProperty(instance, propertyName, newValue)
end

return UniversalReactive

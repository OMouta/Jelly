--!strict
--[[
	ReactiveDetector - Universal Reactive Value Detection
	Detects and resolves any reactive value type in the Rex ecosystem
	Part of the Rex Framework Universal Reactivity redesign
--]]

local ReactiveDetector = {}

--[[
	Checks if a value is any type of reactive object
	@param value The value to check
	@return True if the value has reactive capabilities
--]]
function ReactiveDetector.isReactive(value: any): boolean
	if typeof(value) ~= "table" then
		return false
	end
	
	-- Check for Rex state objects
	if ReactiveDetector.isRexState(value) then
		return true
	end
	
	-- Check for computed values
	if ReactiveDetector.isComputedValue(value) then
		return true
	end
	
	-- Check for async state objects
	if ReactiveDetector.isAsyncState(value) then
		return true
	end
	
	-- Check for reactive children objects
	if ReactiveDetector.isReactiveChildren(value) then
		return true
	end
	
	-- Check for custom reactive objects (has get and onChange methods)
	if ReactiveDetector.isCustomReactive(value) then
		return true
	end
	
	return false
end

--[[
	Checks if a value is a Rex state object
	@param value The value to check
	@return True if it's a Rex state object
--]]
function ReactiveDetector.isRexState(value: any): boolean
	return typeof(value) == "table" 
		and typeof(value.get) == "function"
		and typeof(value.set) == "function"
		and typeof(value.onChange) == "function"
		and typeof(value.update) == "function"
end

--[[
	Checks if a value is a computed value
	@param value The value to check
	@return True if it's a computed value
--]]
function ReactiveDetector.isComputedValue(value: any): boolean
	return typeof(value) == "table" 
		and typeof(value.get) == "function"
		and typeof(value.onChange) == "function"
		and value._isComputed == true
end

--[[
	Checks if a value is an async state object
	@param value The value to check
	@return True if it's an async state object
--]]
function ReactiveDetector.isAsyncState(value: any): boolean
	return typeof(value) == "table" 
		and typeof(value.data) == "table"
		and typeof(value.loading) == "table"
		and typeof(value.error) == "table"
		and typeof(value.reload) == "function"
		and ReactiveDetector.isRexState(value.data)
		and ReactiveDetector.isRexState(value.loading)
		and ReactiveDetector.isRexState(value.error)
end

--[[
	Checks if a value is a reactive children object
	@param value The value to check
	@return True if it's a reactive children object
--]]
function ReactiveDetector.isReactiveChildren(value: any): boolean
	return typeof(value) == "table" 
		and value.__rexReactiveChildren == true
		and typeof(value.get) == "function"
		and typeof(value.onChange) == "function"
end

--[[
	Checks if a value is a custom reactive object
	@param value The value to check
	@return True if it's a custom reactive object
--]]
function ReactiveDetector.isCustomReactive(value: any): boolean
	return typeof(value) == "table" 
		and typeof(value.get) == "function"
		and typeof(value.onChange) == "function"
		-- Make sure it's not one of the known Rex types
		and not ReactiveDetector.isRexState(value)
		and not ReactiveDetector.isComputedValue(value)
		and not ReactiveDetector.isAsyncState(value)
		and not ReactiveDetector.isReactiveChildren(value)
end

--[[
	Resolves the current value from any reactive object
	@param value The reactive value to resolve
	@return The current value, or the original value if not reactive
--]]
function ReactiveDetector.resolveValue(value: any): any
	if not ReactiveDetector.isReactive(value) then
		return value
	end
	
	-- All reactive objects should have a get() method
	if typeof(value.get) == "function" then
		return value:get()
	end
	
	-- Fallback - return original value
	return value
end

--[[
	Sets up a reactive listener for any reactive object
	@param value The reactive object
	@param callback The function to call when the value changes
	@return Disconnect function to remove the listener
--]]
function ReactiveDetector.onChange(value: any, callback: (newValue: any, oldValue: any?) -> ()): () -> ()
	if not ReactiveDetector.isReactive(value) then
		error("ReactiveDetector.onChange: Value is not reactive")
	end
	
	-- All reactive objects should have an onChange method
	if typeof(value.onChange) == "function" then
		return value:onChange(callback)
	end
	
	-- Fallback - return empty disconnect function
	return function() end
end

--[[
	Checks if a value is an array (table with consecutive integer keys starting from 1)
	@param value The value to check
	@return True if it's an array
--]]
function ReactiveDetector.isArray(value: any): boolean
	if typeof(value) ~= "table" then
		return false
	end
	
	-- Check if it's a Rex element or fragment (not an array)
	if typeof(value.className) == "string" or value.__rexFragment then
		return false
	end
	
	-- Check if it has consecutive integer keys starting from 1
	local count = 0
	for key, _ in pairs(value) do
		if typeof(key) ~= "number" or key ~= math.floor(key) or key < 1 then
			return false
		end
		count = count + 1
	end
	
	-- Check if keys are consecutive from 1 to count
	for i = 1, count do
		if value[i] == nil then
			return false
		end
	end
	
	return count > 0
end

--[[
	Checks if a value is a reactive array (reactive value containing an array)
	@param value The value to check
	@return True if it's a reactive array
--]]
function ReactiveDetector.isReactiveArray(value: any): boolean
	if not ReactiveDetector.isReactive(value) then
		return false
	end
	
	local currentValue = ReactiveDetector.resolveValue(value)
	return ReactiveDetector.isArray(currentValue)
end

--[[
	Gets the reactive type name for debugging purposes
	@param value The value to identify
	@return String describing the reactive type
--]]
function ReactiveDetector.getReactiveType(value: any): string
	if not ReactiveDetector.isReactive(value) then
		return "not-reactive"
	end
	
	if ReactiveDetector.isRexState(value) then
		return "rex-state"
	elseif ReactiveDetector.isComputedValue(value) then
		return "computed-value"
	elseif ReactiveDetector.isAsyncState(value) then
		return "async-state"
	elseif ReactiveDetector.isReactiveChildren(value) then
		return "reactive-children"
	elseif ReactiveDetector.isCustomReactive(value) then
		return "custom-reactive"
	else
		return "unknown-reactive"
	end
end

return ReactiveDetector

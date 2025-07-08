--!strict

local Types = require('./Types')
local HttpService = game:GetService('HttpService')

type RexState<T> = Types.RexState<T>
type RexContext<T> = Types.RexContext<T>
export type AsyncState<T> = {
	data: RexState<T?>,
	loading: RexState<boolean>,
	error: RexState<string?>,
	reload: () -> (),
}

local State = {}
local computedCache: {[string]: {value: any, deps: {any}}} = {}

-- Internal tracking for dependencies and contexts
local currentContext: {[string]: any} = {}
local currentDependencies: {RexState<any>} = {}
local isTracking = false

-- Generate unique IDs
local function generateId(): string
	return HttpService:GenerateGUID(false)
end

-- Deep comparison for better change detection
local function deepEqual(a: any, b: any): boolean
	if a == b then return true end
	if typeof(a) ~= typeof(b) then return false end
	
	if typeof(a) == "table" then
		-- Count keys first
		local countA, countB = 0, 0
		for _ in pairs(a) do countA += 1 end
		for _ in pairs(b) do countB += 1 end
		if countA ~= countB then return false end
		
		-- Compare all key-value pairs
		for key, valueA in pairs(a) do
			if not deepEqual(valueA, b[key]) then return false end
		end
		return true
	end
	
	return false
end

-- Deep clone utility
local function deepClone(value: any): any
	if typeof(value) ~= "table" then return value end
	
	local cloned = {}
	for key, val in pairs(value) do
		cloned[key] = deepClone(val)
	end
	return cloned
end

--[[
Creates a deeply reactive state value.
`Docs` https://rex.tigas.dev/docs/0.2.0/advanced_features/deep_reactivity
@param initialValue The initial table value.
@return RexState<T> object with deep reactivity.
]]
function State.createDeepState<T>(initialValue: T): RexState<T>
	local state: RexState<T> = {
		_value = deepClone(initialValue),
		_listeners = {},
		_isDeep = true,
		get = nil :: any,
		set = nil :: any,
		onChange = nil :: any,
		map = nil :: any,
		update = nil :: any,
		each = nil :: any,
		increment = nil :: any,
		decrement = nil :: any,
		toggle = nil :: any,
		push = nil :: any,
		pop = nil :: any,
		removeAt = nil :: any,
		remove = nil :: any,
		clear = nil :: any,
		setPath = nil :: any,
		getPath = nil :: any,
	}
	
	-- Track access for auto-dependency collection
	function state:get(): T
		if isTracking then
			table.insert(currentDependencies, state)
		end
		return self._value
	end
	
	-- Set with deep comparison
	function state:set(newValue: T): ()
		local clonedValue = deepClone(newValue)
		if not deepEqual(self._value, clonedValue) then
			local oldValue = self._value
			self._value = clonedValue
			
			-- Notify all listeners
			for _, listener in ipairs(self._listeners) do
				task.spawn(listener, clonedValue, oldValue)
			end
		end
	end
	
	-- Immutable update helper
	function state:update(updateFn: (current: T) -> T): ()
		local currentValue = self._value
		local newValue = updateFn(deepClone(currentValue))
		self:set(newValue)
	end
	
	-- Subscribe to changes
	function state:onChange(callback: (newValue: T, oldValue: T) -> ()): () -> ()
		table.insert(self._listeners, callback)
		
		return function()
			local index = table.find(self._listeners, callback)
			if index then
				table.remove(self._listeners, index)
			end
		end
	end
	
	-- Map transformation
	function state:map<U>(mapFn: (value: T) -> U): RexState<U>
		local mappedState = State.createState(mapFn(self._value))
		
		self:onChange(function(newValue)
			mappedState:set(mapFn(newValue))
		end)
		
		return mappedState
	end
	
	-- Each transformation for arrays - maps over individual items
	function state:each(mapFn: (item: any, index: number) -> any): any
		-- Create a reactive children object
		local reactiveChildren = {
			__rexReactiveChildren = true,
			
			get = function()
				local currentValue = state:get()
				if typeof(currentValue) ~= "table" then
					warn("Rex.State:each - Value is not a table/array")
					return {}
				end
				
				local elements = {}
				for i, item in ipairs(currentValue) do
					local element = mapFn(item, i)
					if element then
						-- Ensure elements have keys for efficient reconciliation
						if typeof(element) == "table" and not element.key then
							element.key = tostring(i)
						end
						table.insert(elements, element)
					end
				end
				return elements
			end,
			
			onChange = function(callback: () -> ())
				return state:onChange(callback)
			end
		}
		
		return reactiveChildren
	end
	
	-- Increment helper for numeric states
	function state:increment(amount: number?): ()
		local value = amount or 1
		self:update(function(current)
			if typeof(current) == "number" then
				return current + value
			else
				warn("Rex.State:increment - State value is not a number")
				return current
			end
		end)
	end
	
	-- Decrement helper for numeric states
	function state:decrement(amount: number?): ()
		local value = amount or 1
		self:update(function(current)
			if typeof(current) == "number" then
				return current - value
			else
				warn("Rex.State:decrement - State value is not a number")
				return current
			end
		end)
	end
	
	-- Toggle helper for boolean states
	function state:toggle(): ()
		self:update(function(current)
			if typeof(current) == "boolean" then
				return ((not current) :: any) :: T
			else
				warn("Rex.State:toggle - State value is not a boolean")
				return current
			end
		end)
	end
	
	-- Push helper for array states
	function state:push(...: any): ()
		local items = {...}
		self:update(function(current)
			if typeof(current) == "table" then
				local newArray = deepClone(current)
				for _, item in ipairs(items) do
					table.insert(newArray, item)
				end
				return newArray
			else
				warn("Rex.State:push - State value is not a table/array")
				return current
			end
		end)
	end
	
	-- Pop helper for array states
	function state:pop(): any
		local poppedValue = nil
		self:update(function(current)
			if typeof(current) == "table" and #current > 0 then
				local newArray = deepClone(current)
				poppedValue = table.remove(newArray)
				return newArray
			else
				warn("Rex.State:pop - State value is not a table/array or is empty")
				return current
			end
		end)
		return poppedValue
	end
	
	-- Remove helper for array states (by index)
	function state:removeAt(index: number): ()
		self:update(function(current)
			if typeof(current) == "table" then
				local newArray = {}
				for i, item in ipairs(current) do
					if i ~= index then
						table.insert(newArray, item)
					end
				end
				return (newArray :: any) :: T
			else
				warn("Rex.State:removeAt - State value is not a table/array")
				return current
			end
		end)
	end
	
	-- Remove helper for array states (by value)
	function state:remove(value: any): ()
		self:update(function(current)
			if typeof(current) == "table" then
				local newArray = {}
				for _, item in ipairs(current) do
					if item ~= value then
						table.insert(newArray, item)
					end
				end
				return (newArray :: any) :: T
			else
				warn("Rex.State:remove - State value is not a table/array")
				return current
			end
		end)
	end
	
	-- Clear helper for array/table states
	function state:clear(): ()
		self:update(function(current)
			if typeof(current) == "table" then
				return ({} :: any) :: T
			else
				warn("Rex.State:clear - State value is not a table")
				return current
			end
		end)
	end
	
	-- SetPath helper for nested object states (dot notation: "user.settings.theme")
	function state:setPath(path: string, value: any): ()
		self:update(function(current)
			if typeof(current) ~= "table" then
				warn("Rex.State:setPath - State value is not a table/object")
				return current
			end
			
			local newObj = deepClone(current)
			local keys = string.split(path, ".")
			local target = newObj
			
			-- Navigate to the parent of the target property
			for i = 1, #keys - 1 do
				local key = keys[i]
				if typeof(target[key]) ~= "table" then
					target[key] = {}
				end
				target = target[key]
			end
			
			-- Set the final property
			target[keys[#keys]] = value
			return newObj
		end)
	end
	
	-- GetPath helper for nested object states (dot notation: "user.settings.theme")
	function state:getPath(path: string): any
		local current = self:get()
		if typeof(current) ~= "table" then
			return nil
		end
		
		local keys = string.split(path, ".")
		local value = current
		
		for _, key in ipairs(keys) do
			if typeof(value) == "table" and value[key] ~= nil then
				value = value[key]
			else
				return nil
			end
		end
		
		return value
	end
	
	return state
end

--[[
Creates a reactive state value.
`Docs` https://rex.tigas.dev/docs/0.2.0/api_reference/state
@param initialValue The initial value of the state.
@return RexState<T> object with get, set, and update methods.
]]
function State.createState<T>(initialValue: T): RexState<T>
	local state = State.createDeepState(initialValue)
	-- Ensure update method is always available
	if not state.update then
		function state:update(updateFn: (current: T) -> T): ()
			local currentValue = self._value
			local newValue = updateFn(deepClone(currentValue))
			self:set(newValue)
		end
	end
	-- Ensure each method is always available
	if not state.each then
		function state:each(mapFn: (item: any, index: number) -> any): any
			-- Create a reactive children object
			local reactiveChildren = {
				__rexReactiveChildren = true,
				
				get = function()
					local currentValue = state:get()
					if typeof(currentValue) ~= "table" then
						warn("Rex.State:each - Value is not a table/array")
						return {}
					end
					
					local elements = {}
					for i, item in ipairs(currentValue) do
						local element = mapFn(item, i)
						if element then
							-- Ensure elements have keys for efficient reconciliation
							if typeof(element) == "table" and not element.key then
								element.key = tostring(i)
							end
							table.insert(elements, element)
						end
					end
					return elements
				end,
				
				onChange = function(callback: () -> ())
					return state:onChange(callback)
				end
			}
			
			return reactiveChildren
		end
	end
	return state
end

--[[
Creates a computed state that updates when dependencies change.
`Docs` https://rex.tigas.dev/docs/0.2.0/advanced_features/memoization
@param computeFn The function to compute the value.
@param dependencies Array of RexState dependencies.
@param memoKey (Optional) Unique key for memoization.
@return RexState<T> representing the computed value.
]]
function State.createMemoizedComputed<T>(
	computeFn: () -> T, 
	dependencies: {RexState<any>},
	memoKey: string?
): RexState<T>
	local key = memoKey or generateId()
	local computedState = State.createState(computeFn())
	
	-- Mark as computed for reactive detection
	;(computedState :: any)._isComputed = true
	
	-- Store original set method
	local internalSet = computedState.set
	
	-- Get dependency values for memoization
	local function getDependencyValues(): {any}
		local values = {}
		for _, dep in ipairs(dependencies) do
			table.insert(values, dep:get())
		end
		return values
	end
	
	-- Check if we can use cached value
	local function updateComputed()
		local currentDepValues = getDependencyValues()
		local cached = computedCache[key]
		
		if cached and deepEqual(cached.deps, currentDepValues) then
			-- Use cached value
			internalSet(computedState, cached.value)
		else
			-- Compute new value
			local newValue = computeFn()
			computedCache[key] = {value = newValue, deps = currentDepValues}
			internalSet(computedState, newValue)
		end
	end
	
	-- Set up listeners
	local connections = {}
	for _, dependency in ipairs(dependencies) do
		local disconnect = dependency:onChange(updateComputed)
		table.insert(connections, disconnect)
	end
	-- Prevent external modification
	function computedState:set(_: T): ()
		warn("Rex.State: Cannot directly set computed state value. Computed states are read-only and automatically update when their dependencies change.\n" ..
			"📖 Learn more: https://rex.tigas.dev/docs/0.2.0/api_reference/state#usecomputed\n" ..
			"💡 Tip: To modify the result, update the dependencies that this computed state relies on.")
	end
	
	-- Prevent external updates
	function computedState:update(_: (current: T) -> T): ()
		warn("Rex.State: Cannot directly update computed state value. Computed states are read-only and automatically update when their dependencies change.\n" ..
			"📖 Learn more: https://rex.tigas.dev/docs/0.2.0/api_reference/state#usecomputed\n" ..
			"💡 Tip: To modify the result, update the dependencies that this computed state relies on.")
	end
	
	-- Add destroy method
	function computedState:destroy()
		for _, disconnect in ipairs(connections) do
			disconnect()
		end
		computedCache[key] = nil
	end
	
	return computedState
end

--[[
Creates an automatically tracked computed state.
`Docs` https://rex.tigas.dev/docs/0.2.0/api_reference/state
@param computeFn The function to compute the value.
@return RexState<T> representing the computed value.
]]
function State.createAutoComputed<T>(computeFn: () -> T): RexState<T>
	local dependencies: {RexState<any>} = {}
	
	-- Track dependencies during first run
	isTracking = true
	currentDependencies = {}
	local initialValue = computeFn()
	dependencies = currentDependencies
	isTracking = false
	
	return State.createMemoizedComputed(computeFn, dependencies)
end

--[[
Creates a new context for sharing state.
`Docs` https://rex.tigas.dev/docs/0.2.0/api_reference/context
@param defaultValue The default value for the context.
@return RexContext<T> object.
]]
function State.createContext<T>(defaultValue: T): RexContext<T>
	return {
		defaultValue = defaultValue,
		_contextId = generateId(),
	}
end

--[[
Consumes a context value within a component.
`Docs` https://rex.tigas.dev/docs/0.2.0/api_reference/context
@param context The RexContext to consume.
@return The current value of the context.
]]
function State.useContext<T>(context: RexContext<T>): T
	local value = currentContext[context._contextId]
	return if value ~= nil then value else context.defaultValue
end

--[[
Provides a context value to a function.
`Docs` https://rex.tigas.dev/docs/0.2.0/api_reference/context
@param context The RexContext to provide.
@param value The value to provide.
@param fn The function to wrap with context.
@return The result of the function.
]]
function State.withContext<T>(context: RexContext<T>, value: T, fn: () -> any): any
	local oldValue = currentContext[context._contextId]
	currentContext[context._contextId] = value
	
	local result = fn()
	
	if oldValue ~= nil then
		currentContext[context._contextId] = oldValue
	else
		currentContext[context._contextId] = nil
	end
	
	return result
end

--[[
Creates an async state value that resolves from a promise or async function.
`Docs` https://rex.tigas.dev/docs/0.2.0/advanced_features/async_state
@param asyncFn The async function or promise.
@param dependencies (Optional) Array of RexState dependencies.
@return AsyncState<T> representing the async value.
]]
function State.createAsyncState<T>(asyncFn: () -> T, dependencies: {RexState<any>}?): AsyncState<T>
	local data = State.createState(nil :: T?)
	local loading = State.createState(false)
	local error = State.createState(nil :: string?)
	
	local function load()
		loading:set(true)
		error:set(nil)
		
		task.spawn(function()
			local success, result = pcall(asyncFn)
			
			if success then
				data:set(result)
				error:set(nil)
			else
				local errorMsg = `Rex.State.createAsyncState: Async function failed with error: {tostring(result)}\n` ..
					"📖 Learn more: https://rex.tigas.dev/docs/0.2.0/advanced_features/async_state\n" ..
					"💡 Tip: Check your async function for errors, network issues, or invalid operations."
				error:set(errorMsg)
			end
			
			loading:set(false)
		end)
	end
	
	-- Set up dependency watchers
	if dependencies then
		for _, dep in ipairs(dependencies) do
			dep:onChange(load)
		end
	end
	
	-- Initial load
	load()
	
	return {
		data = data,
		loading = loading,
		error = error,
		reload = load,
	}
end

-- Batch updates with real batching
local batchQueue: {() -> ()} = {}
local isBatching = false

--[[
Batches multiple state updates together.
`Docs` https://rex.tigas.dev/docs/0.2.0/api_reference/state
@param updateFn The function containing batched updates.
]]
function State.batch(updateFn: () -> ()): ()
	if isBatching then
		-- Already batching, just execute
		updateFn()
		return
	end
	
	isBatching = true
	updateFn()
	
	-- Process all queued updates
	task.spawn(function()
		for _, queuedUpdate in ipairs(batchQueue) do
			queuedUpdate()
		end
		batchQueue = {}
		isBatching = false
	end)
end

-- Enhanced watch with validation
--[[
Watches state changes and runs a callback when any dependency changes.
`Docs` https://rex.tigas.dev/docs/0.2.0/api_reference/state
@param states Array of RexState dependencies to watch.
@param callback Function to call when dependencies change.
@param options (Optional) Configuration options for watching.
@return Function to disconnect the watcher.
]]
function State.watch(
	states: {RexState<any>}, 
	callback: () -> (),
	options: {immediate: boolean?, deep: boolean?}?
): () -> ()
	local opts = options or {immediate = false, deep = false}
	local connections = {}
		-- Validate dependencies
	for i, state in ipairs(states) do
		if not State.isState(state) then
			warn(`Rex.State.useWatch: Dependency at index {i} is not a valid state object. Expected a RexState created with useState, useComputed, or useDeepState.\n` ..
				"📖 Learn more: https://rex.tigas.dev/docs/0.2.0/api_reference/state#usewatch\n" ..
				`💡 Got: {typeof(state)}, Expected: RexState object with get(), set(), and onChange() methods.`)
		end
	end
	
	for _, state in ipairs(states) do
		local disconnect = state:onChange(function()
			if isBatching then
				table.insert(batchQueue, callback)
			else
				callback()
			end
		end)
		table.insert(connections, disconnect)
	end
	
	-- Call immediately if requested
	if opts.immediate then
		callback()
	end
	
	return function()
		for _, disconnect in ipairs(connections) do
			disconnect()
		end
	end
end

--[[
Checks if a value is a valid RexState object.
`Docs` https://rex.tigas.dev/docs/0.2.0/api_reference/state
@param value The value to check.
@return True if the value is a RexState.
]]
function State.isState(value: any): boolean
	return typeof(value) == "table" 
		and typeof(value.get) == "function" 
		and typeof(value.set) == "function" 
		and typeof(value.onChange) == "function"
end

return State

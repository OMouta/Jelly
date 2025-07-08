--!strict
--[[
	Rex UI Framework
	A modern, declarative UI framework for Roblox
	Inspired by React and Vue with unified APIs
--]]

local Types = require('@self/Types')
local ElementBuilder = require('@self/ElementBuilder')
local State = require('@self/State')
local Renderer = require('@self/Renderer')

export type RexElement = Types.RexElement
export type RexProps = Types.RexProps
export type RexState<T> = Types.RexState<T>
export type RexChildren = Types.RexChildren
export type RexComponent<T> = Types.RexComponent<T>
export type RexContext<T> = Types.RexContext<T>
export type RexFragment = Types.RexFragment

-- Main Rex API
local Rex = {}

-- State Management API
Rex.useState = State.createState
Rex.useDeepState = State.createDeepState
Rex.useComputed = State.createMemoizedComputed
Rex.useAutoComputed = State.createAutoComputed
Rex.useAsyncState = State.createAsyncState
Rex.useWatch = State.watch
Rex.useBatch = State.batch
Rex.createContext = State.createContext
Rex.useContext = State.useContext
Rex.withContext = State.withContext

-- Effect system
--[[
Runs an effect when dependencies change.
`Docs` https://rex.tigas.dev/docs/0.2.0/core_concepts/lifecycle_hooks
@param effect The function to run as an effect. Return a cleanup function if needed.
@param dependencies (Optional) Array of RexState dependencies.
@return Cleanup function.
]]
function Rex.useEffect(effect: (...any) -> ...any, dependencies: {Types.RexState<any>}?): () -> ()
	local cleanup: (() -> ())?
	
	local function runEffect()
		if cleanup then
			cleanup() -- Clean up previous effect
		end
		local result = effect()
		-- Only set cleanup if the effect returned a function
		if typeof(result) == "function" then
			cleanup = result
		else
			cleanup = nil
		end
	end
	
	if dependencies then
		-- Effect with dependencies - watch for changes
		local disconnect = State.watch(dependencies, runEffect)
		
		-- Run initially
		runEffect()
		
		-- Return cleanup function
		return function()
			if cleanup then
				cleanup()
			end
			disconnect()
		end
	else
		-- Effect without dependencies - run once
		runEffect()
		-- Always return a cleanup function, even if effect didn't provide one
		return function()
			if cleanup then
				cleanup()
			end
		end
	end
end

-- Simple lifecycle hooks (placeholder for now)
--[[
Runs a function when the component mounts.
`Docs` https://rex.tigas.dev/docs/0.2.0/core_concepts/lifecycle_hooks
@param callback The function to run on mount.
@return Cleanup function.
]]
function Rex.onMount(callback: () -> (() -> ())?): () -> ()
	-- For now, just execute immediately (this could be enhanced later)
	local cleanup = callback()
	return cleanup or function() end
end

--[[
Runs a function when the component unmounts.
`Docs` https://rex.tigas.dev/docs/0.2.0/core_concepts/lifecycle_hooks
@param callback The function to run on unmount.
@return Cleanup function.
]]
function Rex.onUnmount(callback: () -> ()): () -> ()
	-- Return the callback as cleanup function
	return callback
end

-- Render function
--[[
Renders a Rex component tree into a parent instance.
`Docs` https://rex.tigas.dev/docs/0.2.0/api_reference/rendering
@param elementOrRenderFn The root component or render function.
@param container The parent Instance to render into.
@param options (Optional) Table with render options.
@return Cleanup function or instance.
]]
function Rex.render(elementOrRenderFn: RexElement | (() -> RexElement), container: Instance, options: {mode: string?}?): any
	-- Validate inputs
	if not elementOrRenderFn then
		error("Rex.render: First argument cannot be nil. Expected a RexElement or render function.\n" ..
			"📖 Learn more: https://rex.tigas.dev/docs/0.2.0/api_reference/rendering#render\n" ..
			"💡 Example: Rex.render(Rex('Frame'){}, playerGui)")
	end
	
	if not container then
		error("Rex.render: Container cannot be nil. Expected a valid Roblox Instance.\n" ..
			"📖 Learn more: https://rex.tigas.dev/docs/0.2.0/api_reference/rendering#render\n" ..
			"💡 Example: Rex.render(element, game.Players.LocalPlayer.PlayerGui)")
	end
	
	if typeof(container) ~= "Instance" then
		error(`Rex.render: Container must be a Roblox Instance, got {typeof(container)}.\n` ..
			"📖 Learn more: https://rex.tigas.dev/docs/0.2.0/api_reference/rendering#render\n" ..
			"💡 Common containers: PlayerGui, ScreenGui, Frame, ScrollingFrame")
	end
	
	local opts = options or {mode = nil}
	
	-- Auto-detect render mode if not specified
	local mode = opts.mode
	if not mode then
		mode = typeof(elementOrRenderFn) == "function" and "reactive" or "static"
	end
	
	if mode == "reactive" or typeof(elementOrRenderFn) == "function" then
		-- Reactive rendering - return cleanup function
		return Renderer.createReactiveRenderer(elementOrRenderFn :: () -> RexElement, container)
	else
		-- Static rendering - return instance  
		return ElementBuilder.instantiate(elementOrRenderFn :: RexElement, container)
	end
end

--[[
Rex(className: string) -> (props: RexProps?) -> RexElement
Shorthand for creating a Rex UI element, e.g. Rex("Frame") { ... }
`Docs` https://rex.tigas.dev/docs/0.2.0/core_concepts/components
]]
local function createElement(className: string): (props: RexProps?) -> RexElement
	-- Validate className early to give better error messages
	if typeof(className) ~= "string" then
		error(`Rex: Element className must be a string, got {typeof(className)}.\n` ..
			"📖 Learn more: https://rex.tigas.dev/docs/0.2.0/core_concepts/components#element-creation\n" ..
			"💡 Example: Rex('Frame') { ... } instead of Rex({className}) { ... }")
	end
	
	if className == "" then
		error("Rex: Element className cannot be empty.\n" ..
			"📖 Learn more: https://rex.tigas.dev/docs/0.2.0/core_concepts/components#element-creation\n" ..
			"💡 Example: Rex('Frame') { ... } instead of Rex('') { ... }")
	end
	
	return function(props: RexProps?): RexElement
		return ElementBuilder.create(className, props)
	end
end

-- Unified component creation helper
--[[
Creates a typed Rex component.
`Docs` https://rex.tigas.dev/docs/0.2.0/core_concepts/components
@param name The name of the component.
@param renderFn The render function for the component.
@return RexComponent<T> function.
]]
function Rex.component<T>(name: string, renderFn: (props: T) -> RexElement): RexComponent<T>
	local component = renderFn
	-- Note: In Luau, we can't add properties to functions, so displayName is conceptual
	return component
end

-- Ref system for instance access
--[[
Creates a ref object for storing mutable values or instances.
`Docs` https://rex.tigas.dev/docs/0.2.0/core_concepts/components
@param initialValue (Optional) The initial value for the ref.
@return RexRef<T> object.
]]
function Rex.useRef<T>(initialValue: T?): Types.RexRef<T>
	return { current = initialValue }
end

-- Fragment for grouping elements without wrapper
--[[
Groups children elements without adding an extra UI instance.
`Docs` https://rex.tigas.dev/docs/0.2.0/core_concepts/components
@param props Table with children and optional key.
@return RexFragment object.
]]
function Rex.Fragment(props: {children: RexChildren, key: string?}): RexFragment
	return ElementBuilder.createFragment(
		ElementBuilder.normalizeChildrenToArray(props.children) or {},
		props.key
	)
end

-- Element cleanup utility
--[[
Safely destroys a Rex element and cleans up all its children and reactive bindings.
Use this when you need to manually clean up elements outside of normal reconciliation.
`Docs` https://rex.tigas.dev/docs/0.2.0/api_reference/rendering
@param element The RexElement to destroy.
]]
function Rex.destroyElement(element: RexElement): ()
	ElementBuilder.destroyElement(element)
end

-- Provider component for context
--[[
Provides a context value to all children.
`Docs` https://rex.tigas.dev/docs/0.2.0/api_reference/context
@param props Table with context, value, and children.
@return RexElement wrapping children with context.
]]
function Rex.Provider<T>(props: {context: RexContext<T>, value: T | RexState<T>, children: RexChildren}): RexElement
	return createElement("Frame") {
		Size = UDim2.fromScale(1, 1),
		BackgroundTransparency = 1,
		
		children = if State.isState(props.value) 
			then (props.value :: RexState<T>):map(function(val)
				return State.withContext(props.context, val, function()
					return props.children
				end)
			end)
			else State.withContext(props.context, props.value :: T, function()
				return props.children
			end)
	}
end

-- Enhanced wrapping system for existing instances
--[[
Wraps an existing Roblox Instance with Rex functionality.
This allows you to enhance Studio-created UI with reactive props and event handlers.
`Docs` https://rex.tigas.dev/docs/0.2.0/api_reference/define
@param instance The Roblox Instance to wrap, or a string name to find child by name.
@return Function that accepts props and returns a wrapped RexElement.
]]
function Rex.define(instance: Instance | string): (props: RexProps?) -> RexElement
	return function(props: RexProps?): RexElement
		return ElementBuilder.createDefinedElement(instance, props)
	end
end

-- Version info
Rex.VERSION = "0.2.2"

-- Internal utilities for better error messages
local function _formatRexError(module: string, message: string, docPath: string?, tip: string?): string
	local formatted = `Rex.{module}: {message}`
	
	if docPath then
		formatted = formatted .. `\n📖 Learn more: https://rex.tigas.dev/docs/0.2.0/{docPath}`
	end
	
	if tip then
		formatted = formatted .. `\n💡 {tip}`
	end
	
	return formatted
end

--[[
Rex(className: string) -> (props: RexProps?) -> RexElement
Shorthand for creating a Rex UI element, e.g. Rex("Frame") { ... }
`Docs` https://rex.tigas.dev/docs/0.2.0/core_concepts/components
]]
setmetatable(Rex, {
	__call = function(_, className: string)
		-- Additional validation in the main entry point
		if typeof(className) ~= "string" then
			error(`Rex: Element className must be a string, got {typeof(className)}.\n` ..
				"📖 Learn more: https://rex.tigas.dev/docs/0.2.0/core_concepts/components#element-creation\n" ..
				"💡 Example: Rex('Frame') { ... } instead of Rex({typeof(className)}) { ... }\n" ..
				"💡 Common mistake: Are you trying to pass props directly? Use Rex('ClassName') { props } instead.")
		end
		
		return createElement(className)
	end,
})

return Rex

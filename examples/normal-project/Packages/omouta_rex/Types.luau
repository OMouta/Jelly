--!strict

-- Core element types
export type RexElement = {
	className: string,
	props: RexProps,
	children: RexChildren?,
	instance: Instance?,
	key: string?, -- Added key support for stable diffing
	_definedInstance: (Instance | string)?, -- For Rex.define() wrapped instances
}

-- Props can contain standard Roblox properties, special Rex properties, and events
export type RexProps = {[any]: any} -- Flexible to handle both string keys and special prop objects

-- Special prop marker type
export type RexSpecialProp = {
	__rexSpecialProp: true,
	name: string,
	apply: ((instance: Instance) -> ())?,
}

-- Children can be a single element, array of elements, or nil
export type RexChildren = RexElement | {RexElement} | RexState<RexElement | {RexElement}> | nil

-- Fragment type for multiple elements without wrapper
export type RexFragment = {
	__rexFragment: true,
	children: {RexElement},
}

-- State management types
export type RexState<T> = {
	get: (self: RexState<T>) -> T,
	set: (self: RexState<T>, value: T) -> (),
	onChange: (self: RexState<T>, callback: (newValue: T, oldValue: T) -> ()) -> () -> (), -- Returns disconnect function
	map: (self: RexState<T>, mapFn: (value: T) -> any) -> any, -- Map method for transformations
	each: (self: RexState<T>, mapFn: (item: any, index: number) -> any) -> any, -- Each method for array mapping
	update: (self: RexState<T>, updateFn: (current: T) -> T) -> (), -- Immutable update helper (always available)
	destroy: ((self: RexState<T>) -> ())?, -- Optional for computed states
	
	-- Phase 3: Enhanced State Operation Helpers
	increment: (self: RexState<T>, amount: number?) -> (), -- Increment numeric states
	decrement: (self: RexState<T>, amount: number?) -> (), -- Decrement numeric states
	toggle: (self: RexState<T>) -> (), -- Toggle boolean states
	push: (self: RexState<T>, ...any) -> (), -- Push items to array states
	pop: (self: RexState<T>) -> any, -- Pop items from array states
	removeAt: (self: RexState<T>, index: number) -> (), -- Remove item by index
	remove: (self: RexState<T>, value: any) -> (), -- Remove item by value
	clear: (self: RexState<T>) -> (), -- Clear array/table states
	setPath: (self: RexState<T>, path: string, value: any) -> (), -- Set nested property
	getPath: (self: RexState<T>, path: string) -> any, -- Get nested property
	
	_value: T,
	_listeners: {(newValue: T, oldValue: T) -> ()},
	_isDeep: boolean?, -- Flag for deep reactive states
	_isComputed: boolean?, -- Flag for computed states
}

-- Component function type (just use plain functions!)
export type RexComponent<T> = (props: T) -> RexElement

-- Prop helper function type
export type RexPropHelper = (instance: Instance) -> ()

-- Event callback types
export type RexEventCallback = (...any) -> ()

-- Renderer types
export type RenderResult = {
	instance: Instance,
	cleanup: () -> (),
}

-- Ref system for easier instance access
export type RexRef<T> = {
	current: T?,
}

-- Context system for shared state
export type RexContext<T> = {
	defaultValue: T,
	_contextId: string,
}

export type RexProvider<T> = {
	context: RexContext<T>,
	value: T | RexState<T>,
	children: RexChildren,
}

-- Virtual DOM and Renderer types
export type VirtualNode = {
	element: RexElement,
	instance: Instance?,
	children: {VirtualNode}?,
}

-- Renderer instance type
export type RendererInstance = {
	update: (newElement: RexElement) -> (),
	destroy: () -> (),
	getInstance: () -> Instance?,
}

return {}

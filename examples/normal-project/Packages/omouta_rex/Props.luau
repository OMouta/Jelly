--!strict

local Types = require(script.Parent.Types)
type RexSpecialProp = Types.RexSpecialProp

local Props = {}

-- Special prop marker for Children (essential)
Props.Children = {
	__rexSpecialProp = true,
	name = "Children",
} :: RexSpecialProp

-- Ref prop for instance access (essential for advanced usage)
Props.Ref = {
	__rexSpecialProp = true,
	name = "Ref",
} :: RexSpecialProp

-- Event handling map
local EVENT_MAP = {
	-- Mouse events
	onClick = "MouseButton1Click",
	onRightClick = "MouseButton2Click",
	onHover = "MouseEnter",
	onLeave = "MouseLeave",
	onMouseEnter = "MouseEnter",
	onMouseLeave = "MouseLeave",
	onMouseMoved = "MouseMoved",
	onMouseWheelForward = "MouseWheelForward",
	onMouseWheelBackward = "MouseWheelBackward",
	onMouseDown = "MouseButton1Down",
	onMouseUp = "MouseButton1Up",
	onRightMouseDown = "MouseButton2Down",
	onRightMouseUp = "MouseButton2Up",
	-- Touch events
	onTouchTap = "TouchTap",
	onTouchLongPress = "TouchLongPress",
	onTouchPan = "TouchPan",
	onTouchPinch = "TouchPinch",
	onTouchRotate = "TouchRotate",
	-- Input events
	onInputBegan = "InputBegan",
	onInputChanged = "InputChanged",
	onInputEnded = "InputEnded",
	-- Focus/Text events
	onFocus = "Focused",
	onBlur = "FocusLost",
	onFocusLost = "FocusLost", -- Alternative name for onBlur
	onTextChanged = "Changed", -- For TextBox
	onActivated = "Activated", -- For buttons
	onSelectionGained = "SelectionGained",
	onSelectionLost = "SelectionLost",
	-- GuiObject events
	onChanged = "Changed",
	onAncestryChanged = "AncestryChanged",
	onChildAdded = "ChildAdded",
	onChildRemoved = "ChildRemoved",
	onDescendantAdded = "DescendantAdded",
	onDescendantRemoving = "DescendantRemoving",
	-- GuiButton events
	onDoubleClick = "MouseButton1DoubleClick",
	-- ScrollingFrame events
	onCanvasPositionChanged = "CanvasPositionChanged",
	-- Gui events
	onPropertyChanged = "PropertyChangedSignal",
}

-- Check if a key is a special prop
function Props.isSpecialProp(key: any): boolean
	return typeof(key) == "table" and key.__rexSpecialProp == true
end

-- Check if a value is a prop helper
function Props.isPropHelper(value: any): boolean
	return typeof(value) == "table" 
		and value.__rexSpecialProp == true 
		and typeof(value.apply) == "function"
end

-- Check if a key is an event prop
function Props.isEventProp(key: string): boolean
	return EVENT_MAP[key] ~= nil
end

-- Setup event handler for an instance
function Props.setupEventHandler(instance: Instance, eventKey: string, handler: any): ()
	local eventName = EVENT_MAP[eventKey]
	if not eventName then
		warn(`Rex.Props: Unknown event prop "{eventKey}". This event is not supported by Rex.\n` ..
			"📖 Learn more: https://rex.tigas.dev/docs/0.2.0/core_concepts/event_handling\n" ..
			"💡 Common events: onClick, onRightClick, onHover, onLeave, onFocus, onBlur, onTextChanged, onActivated\n" ..
			"💡 Also supports: Mouse, Touch, Input, Selection, and GuiObject events - see documentation for full list\n" ..
			"💡 Tip: Check the spelling and capitalization of your event prop.")
		return
	end
	
	if typeof(handler) ~= "function" then
		warn(`Rex.Props: Event handler for "{eventKey}" must be a function, got {typeof(handler)}.\n` ..
			"📖 Learn more: https://rex.tigas.dev/docs/0.2.0/core_concepts/event_handling\n" ..
			"💡 Example: onClick = function() print('clicked!') end")
		return
	end
	
	-- Check if instance has this event
	local success, event = pcall(function()
		return (instance :: any)[eventName]
	end)
	
	if success and typeof(event) == "RBXScriptSignal" then
		-- Special handling for events that should pass the instance as first parameter
		if eventKey == "onFocusLost" or eventKey == "onBlur" then
			event:Connect(function(enterPressed, inputObject)
				handler(instance, enterPressed, inputObject)
			end)
		elseif eventKey == "onTextChanged" then
			event:Connect(function()
				handler(instance)
			end)
		else
			-- Standard event handling
			event:Connect(handler)
		end
	elseif success then
		warn(`Rex.Props: "{eventName}" is not an event on {instance.ClassName}. This instance type doesn't support this event.\n` ..
			"📖 Learn more: https://rex.tigas.dev/docs/0.2.0/core_concepts/event_handling\n" ..
			"💡 Tip: Check the Roblox documentation for events supported by this instance type.")
	else
		warn(`Rex.Props: Failed to access "{eventName}" on {instance.ClassName}. This may indicate an internal error.\n` ..
			"📖 Learn more: https://rex.tigas.dev/docs/0.2.0/core_concepts/event_handling\n" ..
			"💡 Tip: Please report this issue if it persists.")
	end
end

-- Set a property on an instance with error handling
function Props.setProperty(instance: Instance, propertyName: string, value: any): ()
	local success, errorMessage = pcall(function()
		(instance :: any)[propertyName] = value
	end)
	
	if not success then
		warn(`Rex.Props: Failed to set property "{propertyName}" on {instance.ClassName}.\n` ..
			`📖 Learn more: https://rex.tigas.dev/docs/0.2.0/core_concepts/reactive_properties\n` ..
			`💡 Error details: {errorMessage}\n` ..
			`💡 Tip: Check that "{propertyName}" is a valid property for {instance.ClassName} instances, or if the value type is correct.`)
	end
end

return Props

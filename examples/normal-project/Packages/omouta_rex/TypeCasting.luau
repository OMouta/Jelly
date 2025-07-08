--!strict
--[[
	TypeConverters - Universal Auto-Conversion System
	Automatically converts between compatible types for Rex properties
	Part of the Rex Framework Universal Reactivity redesign
--]]

local TypeConverters = {}

-- Identity function for direct value passing
local function identity(value: any): any
	return value
end

-- Core type conversion table
-- Maps value types to property-specific converters
local Converters: {[string]: {[string]: (any) -> any}} = {
	-- Number conversions
	[typeof(0)] = {
		Text = tostring,
		Value = identity,
		Visible = function(x: number): boolean return x > 0 end,
		Transparency = function(x: number): number return math.clamp(x, 0, 1) end,
		BackgroundTransparency = function(x: number): number return math.clamp(x, 0, 1) end,
		TextTransparency = function(x: number): number return math.clamp(x, 0, 1) end,
		-- Size properties with number → scale conversion
		Size = function(x: number): UDim2 return UDim2.fromScale(x, x) end,
		Position = function(x: number): UDim2 return UDim2.fromScale(x, x) end,
	},
	
	-- Boolean conversions
	[typeof(true)] = {
		Visible = identity,
		Text = function(x: boolean): string return x and "true" or "false" end,
		Active = identity,
		Selectable = identity,
		AutoButtonColor = identity,
		ClipsDescendants = identity,
		Modal = identity,
		Enabled = identity,
		-- Convert boolean to transparency (false = hidden, true = visible)
		Transparency = function(x: boolean): number return x and 0 or 1 end,
		BackgroundTransparency = function(x: boolean): number return x and 0 or 1 end,
	},
	
	-- String conversions
	[typeof("")] = {
		Text = identity,
		Name = identity,
		PlaceholderText = identity,
		Font = function(x: string): Enum.Font
			-- Try to convert string to Font enum
			local success, font = pcall(function()
				return (Enum.Font :: any)[x]
			end)
			return success and font or Enum.Font.SourceSans
		end,
	},
	
	-- Vector2 conversions
	[typeof(Vector2.new())] = {
		AnchorPoint = identity,
		-- Convert Vector2 to UDim2 for size/position
		Size = function(v: Vector2): UDim2 return UDim2.fromOffset(v.X, v.Y) end,
		Position = function(v: Vector2): UDim2 return UDim2.fromOffset(v.X, v.Y) end,
	},
	
	-- Color3 conversions
	[typeof(Color3.new())] = {
		BackgroundColor3 = identity,
		TextColor3 = identity,
		BorderColor3 = identity,
		-- Convert Color3 to string for text display
		Text = function(c: Color3): string 
			return `rgb({math.floor(c.R * 255)}, {math.floor(c.G * 255)}, {math.floor(c.B * 255)})`
		end,
	},
	
	-- UDim2 conversions
	[typeof(UDim2.new())] = {
		Size = identity,
		Position = identity,
	},
	
	-- UDim conversions
	[typeof(UDim.new())] = {
		CornerRadius = identity, -- For UICorner
	},
	
	-- Enum conversions
	[typeof(Enum.Font.SourceSans)] = {
		Font = identity,
	},
	
	-- Phase 3: Intelligent Default Converters
	
	-- Table/Array conversions (add a special key since typeof({}) is not reliable)
	["table"] = {
		-- Convert array to list layout order for children
		LayoutOrder = function(arr: {any}): number return #arr end,
		-- Convert array to formatted text for display
		Text = function(arr: {any}): string 
			if #arr == 0 then
				return "[]"
			end
			local formatted = {}
			for i, item in ipairs(arr) do
				local str = tostring(item)
				if i <= 5 then -- Show first 5 items
					table.insert(formatted, str)
				elseif i == 6 then
					table.insert(formatted, "...") -- Show ellipsis for more
					break
				end
			end
			return `[{table.concat(formatted, ", ")}]`
		end,
		-- Convert table to count for Size/Position offsets
		Size = function(arr: {any}): UDim2 
			local count = #arr
			return UDim2.fromOffset(math.max(count * 20, 100), 30)
		end,
	},
	
	-- CFrame conversions  
	[typeof(CFrame.new())] = {
		CFrame = identity,
		-- Convert CFrame position to UDim2 for 2D layouts
		Position = function(cf: CFrame): UDim2 
			return UDim2.fromOffset(cf.Position.X, cf.Position.Y)
		end,
		Text = function(cf: CFrame): string
			local pos = cf.Position
			return `({math.floor(pos.X)}, {math.floor(pos.Y)}, {math.floor(pos.Z)})`
		end,
	},
	
	-- Instance conversions
	["Instance"] = {
		-- Convert instance to its name for text display
		Text = function(inst: Instance): string return inst.Name end,
		Name = function(inst: Instance): string return inst.Name end,
		-- Convert instance visibility to boolean
		Visible = function(inst: Instance): boolean 
			return if inst:IsA("GuiObject") then (inst :: GuiObject).Visible else true
		end,
	},
}
--[[
	Automatically converts a value to be compatible with a property
	@param value The value to convert
	@param propertyName The target property name
	@return The converted value, or original value if no conversion available
--]]
function TypeConverters.autoConvert(value: any, propertyName: string): any
	if value == nil then
		return nil
	end
	
	local valueType = typeof(value)
	local typeConverters = Converters[valueType]
	
	-- Phase 3: Handle special type cases
	if not typeConverters then
		if valueType == "table" then
			typeConverters = Converters["table"]
		elseif typeof(value) == "userdata" and typeof(value.IsA) == "function" then
			-- Handle Roblox instances
			typeConverters = Converters["Instance"]
		end
	end
	
	if not typeConverters then
		-- No converters for this type, return as-is
		return value
	end
	
	local converter = typeConverters[propertyName]
	if not converter then
		-- No converter for this property, return as-is
		return value
	end
	
	-- Apply conversion with error handling
	local success, result = pcall(converter, value)
	if success then
		return result
	else
		-- Conversion failed, warn and return original value
		warn(`Rex.TypeConverters: Failed to convert {valueType} to {propertyName}: {result}`)
		return value
	end
end

--[[
	Registers a custom converter for a specific type and property combination
	@param valueType The typeof() result for the value type
	@param propertyName The property name to convert for
	@param converter Function that converts the value
--]]
function TypeConverters.registerConverter(valueType: string, propertyName: string, converter: (any) -> any): ()
	if not Converters[valueType] then
		Converters[valueType] = {}
	end
	
	Converters[valueType][propertyName] = converter
end

--[[
	Checks if a conversion is available for a value type and property
	@param valueType The typeof() result for the value type
	@param propertyName The property name
	@return True if conversion is available
--]]
function TypeConverters.hasConverter(valueType: string, propertyName: string): boolean
	return Converters[valueType] ~= nil and Converters[valueType][propertyName] ~= nil
end

--[[
	Gets all available property conversions for a value type
	@param valueType The typeof() result for the value type
	@return Table of property names that can be converted
--]]
function TypeConverters.getAvailableConversions(valueType: string): {string}
	local typeConverters = Converters[valueType]
	if not typeConverters then
		return {}
	end
	
	local conversions = {}
	for propertyName, _ in pairs(typeConverters) do
		table.insert(conversions, propertyName)
	end
	return conversions
end

return TypeConverters

-- This is a shared module
local Hello = {}

function Hello.sayHello(name: string): string
	return "Hello, " .. name .. "!"
end

return Hello
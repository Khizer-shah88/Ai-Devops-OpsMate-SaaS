import re

with open("modules/ai/ai.service.ts", "r") as f:
    code = f.read()

# Remove response_format
code = code.replace("response_format: { type: 'json_object' },", "")

# Increase max tokens
code = code.replace("max_tokens: 1200,", "max_tokens: 4000,")

# Add a function to safely parse json from markdown fences
old_json_parse = """
                if (!content) {
                        throw new InternalServerErrorException('Empty AI response');
                }

                return JSON.parse(content) as T;
        } catch (error) {
                throw new InternalServerErrorException(
                        `AI request failed: ${error instanceof Error ? error.message : 'unknown error'}`,
                );
        }"""

new_json_parse = """
                if (!content) {
                        throw new InternalServerErrorException('Empty AI response');
                }

                let cleanContent = content.trim();
                if (cleanContent.startsWith('```json')) {
                    cleanContent = cleanContent.replace(/^```json/, '').replace(/```$/, '').trim();
                } else if (cleanContent.startsWith('```')) {
                    cleanContent = cleanContent.replace(/^```/, '').replace(/```$/, '').trim();
                }

                try {
                    return JSON.parse(cleanContent) as T;
                } catch (parseError) {
                    console.error("Failed to parse JSON, content was:", cleanContent);
                    throw new InternalServerErrorException('AI returned invalid JSON.');
                }
        } catch (error) {
                console.error("AI service error:", error);
                throw new InternalServerErrorException(
                        `AI request failed: ${error instanceof Error ? error.message : 'unknown error'}`,
                );
        }"""

code = code.replace(old_json_parse, new_json_parse)

# Fix system prompt to be more emphatic about json
code = code.replace(
    "content: 'Always return only valid JSON without markdown fences.',",
    "content: 'Always return ONLY valid JSON. Do not include any conversational text or markdown formatting. Output must start with { and end with }.',"
)

with open("modules/ai/ai.service.ts", "w") as f:
    f.write(code)

print("Fixed")

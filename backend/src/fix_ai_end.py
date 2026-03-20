import re

with open("modules/ai/ai.service.ts", "r") as f:
    code = f.read()

new_end = """                        const content = response.choices[0]?.message?.content;

                        if (!content) {
                                throw new InternalServerErrorException('Empty AI response');
                        }

                        let cleanContent = content.trim();
                        if (cleanContent.startsWith('```json')) {
                            cleanContent = cleanContent.replace(/^```json\\n?/, '').replace(/```$/, '').trim();
                        } else if (cleanContent.startsWith('```')) {
                            cleanContent = cleanContent.replace(/^```\\n?/, '').replace(/```$/, '').trim();
                        }

                        try {
                            return JSON.parse(cleanContent) as T;
                        } catch (parseError) {
                            console.error("AI JSON Parse Error:", parseError, "Content:", cleanContent);
                            throw new InternalServerErrorException('AI returned invalid JSON');
                        }
                } catch (error) {
                        console.error("AI Request Error:", error);
                        throw new InternalServerErrorException(
                                `AI request failed: ${error instanceof Error ? error.message : 'unknown error'}`
                        );
                }
        }
}"""

# split by `const content = response.choices...`
parts = code.split('const content = response.choices[0]?.message?.content;')
new_code = parts[0] + new_end

with open("modules/ai/ai.service.ts", "w") as f:
    f.write(new_code)


import {
    loadModel,
    LLAMA_3_2_1B_INST_Q4_0,
    completion,
    unloadModel
} from "@qvac/sdk";

async function main() {
    let modelId;

    try {
        console.log("Loading the QVAC AI model...");

        modelId = await loadModel({
            modelSrc: LLAMA_3_2_1B_INST_Q4_0,
            onProgress: (p) => {
                console.log(`Download progress: ${p.percentage.toFixed(0)}%`);
            }
        });

        console.log("\nModel loaded. Testing local AI...\n");

        const run = completion({
            modelId,
            history: [
                {
                    role: "user",
                    content:
                        "Explain this in simple English: An applicant must submit all required documents before the stated deadline."
                }
            ],
            stream: true
        });

        for await (const token of run.tokenStream) {
            process.stdout.write(token);
        }

        console.log("\n\nQVAC test completed successfully.");
    } catch (error) {
        console.error("QVAC test failed:", error);
        process.exitCode = 1;
    } finally {
        if (modelId) {
            try {
                await unloadModel({ modelId });
            } catch (error) {
                console.error("Could not unload model:", error);
            }
        }
    }
}

main();

// ✅ ALWAYS show UI first (prevents infinite loading)
figma.showUI(__html__, { width: 320, height: 420 });

const API_KEY = "28e77db7a46e433fae3f09aafb9d122e";
const USER_ID = "1jTar6n69UT6TTHIec2XYvfcyY02";
const PIPELINE_ID = "99LLfeNiFK8Zr6tMG2DiDm";

figma.ui.onmessage = async (msg) => {
  if (msg.type !== "ANALYZE") return;

  const selection = figma.currentPage.selection;

  if (!selection.length) {
    figma.ui.postMessage({
      type: "ERROR",
      message: "Please select a frame or group."
    });
    return;
  }

  // ✅ SAFE summary (TypeScript-friendly)
  const summary = selection.map(node => {
    const childCount =
      "children" in node && Array.isArray(node.children)
        ? node.children.length
        : 0;

    return {
      name: node.name,
      type: node.type,
      width: node.width,
      height: node.height,
      children: childCount
    };
  });

  try {
    // 1️⃣ Start Gumloop pipeline
    const startRes = await fetch(
      "https://api.gumloop.com/api/v1/start_pipeline?api_key=28e77db7a46e433fae3f09aafb9d122e&user_id=1jTar6n69UT6TTHIec2XYvfcyY02&saved_item_id=99LLfeNiFK8Zr6tMG2DiDm",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": "28e77db7a46e433fae3f09aafb9d122e"
        },
        body: JSON.stringify({
          inputs: {
            design_summary: JSON.stringify(summary)
          }
        })
      }
    );

    const startData = await startRes.json();
    const runId = startData.run_id;

    if (!runId) {
      throw new Error("No run_id returned from Gumloop");
    }

    // 2️⃣ Poll (HARD STOP after attempts)
    let feedback = "No feedback returned.";

    for (let i = 0; i < 8; i++) {
      await new Promise(r => setTimeout(r, 1500));

      const runRes = await fetch(
        "https://api.gumloop.com/api/v1/start_pipeline?api_key=28e77db7a46e433fae3f09aafb9d122e&user_id=1jTar6n69UT6TTHIec2XYvfcyY02&saved_item_id=99LLfeNiFK8Zr6tMG2DiDm",
        {
          headers: { "x-api-key": API_KEY }
        }
      );

      const runData = await runRes.json();

      if (runData.status === "completed") {
        feedback =
          runData.outputs?.feedback ??
          JSON.stringify(runData.outputs, null, 2);
        break;
      }

      if (runData.status === "failed") {
        feedback = "Gumloop pipeline failed.";
        break;
      }
    }

    // 3️⃣ Send TEXT back to UI (important)
    figma.ui.postMessage({
      type: "AI_FEEDBACK",
      text: feedback
    });

  } catch (err) {
    const message =
      err instanceof Error ? err.message : String(err);

    figma.ui.postMessage({
      type: "ERROR",
      message: "Gumloop error: " + message
    });
  }
};

document.getElementById("closeBtn").addEventListener("click", () => {
  window.close();
});

const params = new URL(window.location.href).searchParams;
const reason = params.get("reason");
const detail = params.get("detail")?.trim();

const reasonText = reason === "keyword" ? "Keyword detected" : "Page blocked";
const reasonDetail = detail ? `: ${detail}` : "";
document.getElementById("reason").textContent = `Protected from ${reasonText}${reasonDetail}`;
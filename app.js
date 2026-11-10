const tg = window.Telegram?.WebApp;
if (tg) { tg.ready(); tg.expand(); }
const list = document.getElementById("videos");
const statusEl = document.getElementById("status");

async function loadVideos() {
  try {
    const res = await fetch("/api/videos");
    const videos = await res.json();
    list.innerHTML = "";
    if (!videos.length) { list.innerHTML = "<p>এখনো কোনো ভিডিও যোগ করা হয়নি।</p>"; return; }
    for (const video of videos) {
      const card = document.createElement("article");
      card.className = "item";
      const title = document.createElement("h2");
      title.textContent = video.title;
      const button = document.createElement("button");
      button.textContent = "Telegram-এ পাঠান";
      button.addEventListener("click", () => unlock(video.id));
      card.append(title, button);
      list.append(card);
    }
  } catch { list.innerHTML = "<p>ভিডিও লোড করা যায়নি।</p>"; }
}
async function unlock(videoId) {
  if (!tg?.initData) { statusEl.textContent = "এই পেজটি Telegram Mini App থেকে খুলুন।"; return; }
  statusEl.textContent = "পাঠানো হচ্ছে…";
  try {
    const res = await fetch("/api/unlock", {
      method: "POST", headers: {"Content-Type":"application/json"},
      body: JSON.stringify({ initData: tg.initData, videoId })
    });
    const data = await res.json();
    statusEl.textContent = data.message || data.error || "সম্পন্ন";
  } catch { statusEl.textContent = "অনুরোধ সম্পন্ন করা যায়নি।"; }
}
loadVideos();
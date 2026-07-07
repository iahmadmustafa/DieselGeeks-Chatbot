(function () {
  if (document.getElementById("dieselgeeks-chat-host")) {
    return;
  }

  var currentScript = document.currentScript;
  var apiUrl =
    (currentScript && currentScript.getAttribute("data-api-url")) ||
    window.DIESELGEEKS_CHAT_API_URL ||
    window.location.origin;
  apiUrl = apiUrl.replace(/\/$/, "");

  var bundle = document.createElement("script");
  bundle.src = apiUrl + "/dieselgeeks-chat.js";
  bundle.async = true;
  bundle.defer = true;
  bundle.setAttribute("data-api-url", apiUrl);
  bundle.onerror = function () {
    console.warn("[DieselGeeks Chat] Failed to load widget bundle from", bundle.src);
  };

  document.head.appendChild(bundle);
})();

(function () {
  if (document.getElementById("dieselgeeks-chat-host")) {
    return;
  }

  // Paints the homepage hero mount point dark immediately, before the (much
  // larger) chat bundle has even finished downloading/parsing — without
  // this, the empty placeholder div sits there with the page's default
  // white background for a beat, then "pops" to the real dark interface
  // once React mounts. This is just a plain background-color, no image, so
  // it costs nothing to apply this early and never visibly clashes with
  // HeroChat's own background once it takes over.
  var style = document.createElement("style");
  style.textContent =
    "#dg-hero-chat{background:#05070a;min-height:min(88vh,820px);border-radius:0;overflow:hidden;}" +
    "@media (max-width:640px){#dg-hero-chat{min-height:min(90vh,640px);}}";
  document.head.appendChild(style);

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

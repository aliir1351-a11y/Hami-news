"use strict";

(() => {
  const API = {
    news: "/api/news",
    refresh: "/api/refresh",
    market: "/api/market",
    translate: "/api/translate",
    feedback: "/api/feedback",
    view: "/api/view",
    newsletter: "/api/newsletter",
    report: "/api/report"
  };

  const PAGE_SIZE = 12;
  const COMMENT_RATE_LIMIT = 45_000;
  const storage = createSafeStorage();
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

  const state = {
    items: [],
    updatedAt: null,
    nextUpdate: null,
    status: "آماده",
    filter: "all",
    query: "",
    sort: "recent",
    savedOnly: false,
    visible: PAGE_SIZE,
    openId: null,
    modes: new Map(),
    saved: new Set(storage.getJSON("radar_saved_v4", [])),
    localViews: storage.getJSON("radar_views_v4", {}),
    feedback: storage.getJSON("radar_feedback_v4", {}),
    viewedSession: new Set(),
    feedbackLoaded: new Set(),
    readerItem: null,
    readerSize: 1,
    loadSource: "",
    searchTimer: null,
    refreshInProgress: false
  };

  const els = {
    grid: $("#newsGrid"),
    search: $("#searchInput"),
    clearSearch: $("#clearSearch"),
    searchSpinner: $("#searchSpinner"),
    sort: $("#sortBy"),
    refresh: $("#refreshButton"),
    resultCount: $("#resultCount"),
    loadMore: $("#loadMore"),
    activeFilter: $("#activeFilter"),
    activeFilterText: $("#activeFilterText"),
    savedOnly: $("#savedOnly"),
    savedCount: $("#savedCount"),
    connectionPill: $("#connectionPill"),
    connectionText: $("#connectionText"),
    updatedAt: $("#updatedAt"),
    nextUpdate: $("#nextUpdate"),
    heroCount: $("#heroCount"),
    indicatorGrid: $("#indicatorGrid"),
    weekChart: $("#weekChart"),
    weekTotal: $("#weekTotal"),
    marketUpdated: $("#marketUpdated"),
    analysisMode: $("#analysisMode"),
    analysisTitle: $("#analysisTitle"),
    analysisBody: $("#analysisBody"),
    analysisTags: $("#analysisTags"),
    signalRail: $("#signalRail"),
    topStories: $("#topStories"),
    topStoryGrid: $("#topStoryGrid"),
    reader: $("#readerDialog"),
    readerSource: $("#readerSource"),
    readerTitle: $("#readerTitle"),
    readerMeta: $("#readerMeta"),
    readerBody: $("#readerBody"),
    readerActions: $("#readerActions"),
    report: $("#reportDialog"),
    toastRegion: $("#toastRegion"),
    backTop: $("#backTop")
  };

  const iconPaths = {
    eye: "M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6S2.5 12 2.5 12Zm9.5 3a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z",
    clock: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-13v4.5l3 2",
    chevron: "m7 9 5 5 5-5",
    book: "M4 5.5A2.5 2.5 0 0 1 6.5 3H11a3 3 0 0 1 3 3v15a3 3 0 0 0-3-3H4V5.5Zm16 0A2.5 2.5 0 0 0 17.5 3H14v18a3 3 0 0 1 3-3h3V5.5Z",
    bookmark: "M6 4.8A1.8 1.8 0 0 1 7.8 3h8.4A1.8 1.8 0 0 1 18 4.8V21l-6-3.5L6 21V4.8Z",
    share: "M8.7 13.3 15.3 17M15.3 7 8.7 10.7M18 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM6 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm12 7a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z",
    flag: "M5 22V4m0 1h11l-1.5 4L18 13H5",
    external: "M14 4h6v6m0-6-9 9M20 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h5",
    copy: "M8 8h11a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H10a2 2 0 0 1-2-2V8Zm8 0V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3",
    message: "M21 11.5a8.5 8.5 0 0 1-9 8.5 10 10 0 0 1-4-.9L3 21l1.7-4.3A8.5 8.5 0 1 1 21 11.5Z",
    home: "M3 11 12 4l9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1v-9Z"
  };

  function createSafeStorage() {
    return {
      get(key, fallback = null) {
        try {
          const value = localStorage.getItem(key);
          return value === null ? fallback : value;
        } catch {
          return fallback;
        }
      },
      set(key, value) {
        try {
          localStorage.setItem(key, value);
          return true;
        } catch {
          return false;
        }
      },
      getJSON(key, fallback) {
        try {
          const value = localStorage.getItem(key);
          return value ? JSON.parse(value) : fallback;
        } catch {
          return fallback;
        }
      },
      setJSON(key, value) {
        try {
          localStorage.setItem(key, JSON.stringify(value));
          return true;
        } catch {
          return false;
        }
      }
    };
  }

  function node(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined && text !== null) element.textContent = String(text);
    return element;
  }

  function icon(name) {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");
    path.setAttribute("d", iconPaths[name] || iconPaths.home);
    svg.append(path);
    return svg;
  }

  function actionButton(label, action, id, iconName, className = "") {
    const button = node("button", className);
    button.type = "button";
    button.dataset.action = action;
    if (id) button.dataset.id = id;
    if (iconName) button.append(icon(iconName));
    button.append(node("span", "", label));
    return button;
  }

  function safeUrl(value) {
    try {
      const url = new URL(String(value || ""), window.location.href);
      return ["http:", "https:"].includes(url.protocol) ? url.href : "#";
    } catch {
      return "#";
    }
  }

  function sourceClass(value) {
    let hash = 0;
    for (const character of String(value || "?")) hash = ((hash << 5) - hash + character.charCodeAt(0)) | 0;
    return `source-color-${Math.abs(hash) % 6}`;
  }

  function sourceInitials(value) {
    const clean = String(value || "?").trim();
    const words = clean.split(/\s+/).filter(Boolean);
    if (!words.length) return "؟";
    if (/[A-Za-z]/.test(clean)) return words.slice(0, 2).map((part) => part[0]).join("").toUpperCase();
    return clean.slice(0, 2);
  }

  function faNumber(value, maximumFractionDigits = 0) {
    const number = Number(value);
    if (!Number.isFinite(number)) return "۰";
    return new Intl.NumberFormat("fa-IR", { maximumFractionDigits }).format(number);
  }

  function faDate(iso, options = {}) {
    if (!iso) return "زمان نامشخص";
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return String(iso);
    try {
      return new Intl.DateTimeFormat("fa-IR", {
        dateStyle: options.dateOnly ? "medium" : "medium",
        ...(options.dateOnly ? {} : { timeStyle: "short" }),
        timeZone: "Asia/Tehran"
      }).format(date);
    } catch {
      return date.toLocaleString("fa-IR");
    }
  }

  function relativeTime(iso) {
    const time = new Date(iso).getTime();
    if (!Number.isFinite(time)) return "زمان نامشخص";
    const minutes = Math.round((time - Date.now()) / 60_000);
    const formatter = new Intl.RelativeTimeFormat("fa-IR", { numeric: "auto" });
    if (Math.abs(minutes) < 60) return formatter.format(minutes, "minute");
    const hours = Math.round(minutes / 60);
    if (Math.abs(hours) < 24) return formatter.format(hours, "hour");
    const days = Math.round(hours / 24);
    if (Math.abs(days) < 30) return formatter.format(days, "day");
    return faDate(iso, { dateOnly: true });
  }

  function isNew(item) {
    const published = new Date(item.published).getTime();
    return Number.isFinite(published) && Date.now() - published >= 0 && Date.now() - published < 86_400_000;
  }

  function normalizeItem(item, index) {
    const id = String(item.id || `news-${index}`);
    const localFeedback = state.feedback[id] || {};
    const serverViews = Number(item.views || 0);
    const localViews = Number(state.localViews[id] || 0);
    return {
      ...item,
      id,
      title: String(item.title || item.title_orig || "بدون عنوان"),
      title_orig: String(item.title_orig || ""),
      summary: String(item.summary || "خلاصه‌ای برای این خبر ثبت نشده است."),
      source: String(item.source || "منبع نامشخص"),
      source_fa: String(item.source_fa || item.source || "منبع نامشخص"),
      region: item.region === "iran" ? "iran" : "world",
      feed: String(item.feed || "بازار مسکن"),
      full_fa: String(item.full_fa || ""),
      image: safeUrl(item.image || item.image_url || "") === "#" ? "" : safeUrl(item.image || item.image_url || ""),
      url: safeUrl(item.url),
      views: Math.max(serverViews, localViews),
      rate_avg: Number(item.rate_avg ?? item.rating_average ?? localFeedback.average ?? 0),
      rate_count: Number(item.rate_count ?? item.rating_count ?? localFeedback.count ?? 0),
      comment_count: Number(item.comment_count ?? item.comments_count ?? (localFeedback.comments || []).length ?? 0)
    };
  }

  function hasUsefulFullText(item) {
    const text = String(item?.full_fa || "").trim();
    if (text.length < 180) return false;
    if (text === item.title || text === item.summary) return false;
    return true;
  }

  async function fetchJSON(url, options = {}, timeout = 7_000) {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), timeout);
    try {
      const response = await fetch(url, {
        cache: "no-store",
        credentials: "same-origin",
        ...options,
        signal: controller.signal,
        headers: {
          Accept: "application/json",
          ...(options.body ? { "Content-Type": "application/json" } : {}),
          ...csrfHeaders(),
          ...(options.headers || {})
        }
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } finally {
      window.clearTimeout(timer);
    }
  }

  function csrfHeaders() {
    const match = document.cookie.match(/(?:^|;\s*)(?:csrftoken|csrf_token)=([^;]+)/i);
    return match ? { "X-CSRF-Token": decodeURIComponent(match[1]) } : {};
  }

  function showSkeletons() {
    els.grid.replaceChildren();
    for (let index = 0; index < 6; index += 1) {
      const card = node("div", "skeleton-card");
      const image = node("div", "skeleton-block");
      const copy = node("div", "skeleton-copy");
      copy.append(node("div", "skeleton-line short"), node("div", "skeleton-line"), node("div", "skeleton-line"));
      card.append(image, copy);
      els.grid.append(card);
    }
    els.grid.setAttribute("aria-busy", "true");
  }

  function readEmbeddedNews() {
    const element = document.getElementById("radar-bootstrap");
    if (!element) return null;
    try {
      const data = JSON.parse(element.textContent || "");
      return data && Array.isArray(data.items) ? data : null;
    } catch {
      return null;
    }
  }

  async function loadNews({ silent = false } = {}) {
    if (!silent) showSkeletons();
    const embedded = readEmbeddedNews();
    const localDocument = ["file:", "content:"].includes(window.location.protocol);
    let data = localDocument ? embedded : null;
    let source = data ? "embedded" : "";
    const candidates = [API.news, "data/cache.json"];
    if (!data) {
      for (const candidate of candidates) {
        try {
          data = await fetchJSON(candidate);
          source = candidate === API.news ? "api" : "cache";
          break;
        } catch {
          // Continue to the packaged snapshot when the live API is unavailable.
        }
      }
    }
    if (!data && embedded) {
      data = embedded;
      source = "embedded";
    }

    if (!data || !Array.isArray(data.items)) {
      showLoadError();
      updateConnection(false, "داده‌ای دریافت نشد");
      return false;
    }

    state.items = data.items.map(normalizeItem);
    state.updatedAt = data.updated_at || null;
    state.nextUpdate = data.next_update || null;
    state.status = data.status || "آماده";
    state.loadSource = source;
    applyHeaderData(data);
    renderAll();
    updateConnection(navigator.onLine, source === "api" ? "رادار برخط" : "نسخه ذخیره‌شده");
    if (data.error) toast(String(data.error), "error");
    void loadMarket();
    return true;
  }

  function showLoadError() {
    els.grid.replaceChildren();
    const box = node("div", "error-state");
    const copy = node("div");
    copy.append(node("strong", "", "اتصال به رادار برقرار نشد"));
    copy.append(node("p", "", "API خبر و فایل پشتیبان هر دو در دسترس نبودند. اتصال را بررسی و دوباره تلاش کنید."));
    box.append(copy);
    els.grid.append(box);
    els.grid.setAttribute("aria-busy", "false");
    els.resultCount.textContent = "بدون داده";
  }

  function applyHeaderData(data) {
    els.heroCount.textContent = faNumber(state.items.length);
    els.updatedAt.textContent = state.updatedAt ? `آخرین برداشت: ${faDate(state.updatedAt)}` : "آخرین برداشت: ثبت نشده";
    els.nextUpdate.textContent = state.nextUpdate ? `دور بعد: ${faDate(state.nextUpdate)}` : "به‌روزرسانی خودکار هر ساعت";
    const countText = `${faNumber(state.items.length)} خبر`;
    els.connectionText.textContent = `${data.status || "آماده"} · ${countText}`;
    updateSavedCount();
  }

  function renderAll() {
    renderNews();
    renderSignals();
    renderTopStories();
    renderFallbackMarket();
    renderWeekChart();
  }

  function getFilteredItems() {
    let list = state.items.slice();
    if (state.filter !== "all") list = list.filter((item) => item.region === state.filter);
    if (state.savedOnly) list = list.filter((item) => state.saved.has(item.id));
    if (state.query) {
      const needle = state.query.toLocaleLowerCase("fa");
      list = list.filter((item) => [item.title, item.title_orig, item.summary, item.source, item.source_fa, item.feed]
        .join(" ").toLocaleLowerCase("fa").includes(needle));
    }
    if (state.sort === "popular") {
      list.sort((a, b) => b.views - a.views || dateValue(b) - dateValue(a));
    } else if (state.sort === "discussed") {
      list.sort((a, b) => discussionCount(b) - discussionCount(a) || b.rate_count - a.rate_count || dateValue(b) - dateValue(a));
    } else {
      list.sort((a, b) => dateValue(b) - dateValue(a));
    }
    return list;
  }

  function dateValue(item) {
    const value = new Date(item.published).getTime();
    return Number.isFinite(value) ? value : 0;
  }

  function discussionCount(item) {
    return Number(item.comment_count || 0);
  }

  function renderNews() {
    const list = getFilteredItems();
    const visible = list.slice(0, state.visible);
    els.grid.replaceChildren();

    if (!list.length) {
      const box = node("div", "empty-state");
      const copy = node("div");
      copy.append(node("strong", "", state.savedOnly ? "هنوز خبری ذخیره نکرده‌اید" : "خبری با این فیلتر پیدا نشد"));
      copy.append(node("p", "", state.savedOnly ? "از دکمه «ذخیره» داخل هر خبر استفاده کنید تا بعداً سریع به آن برگردید." : "عبارت جستجو یا فیلتر منطقه را تغییر دهید."));
      box.append(copy);
      els.grid.append(box);
    } else {
      const fragment = document.createDocumentFragment();
      visible.forEach((item) => fragment.append(buildNewsCard(item)));
      els.grid.append(fragment);
    }

    els.grid.setAttribute("aria-busy", "false");
    els.resultCount.textContent = `${faNumber(list.length)} نتیجه${list.length > visible.length ? ` · نمایش ${faNumber(visible.length)}` : ""}`;
    els.loadMore.hidden = visible.length >= list.length;
    updateActiveFilter();
  }

  function buildNewsCard(item) {
    const article = node("article", `news-card${state.openId === item.id ? " open" : ""}`);
    article.dataset.id = item.id;

    const head = node("button", "news-card-head");
    head.type = "button";
    head.dataset.action = "toggle";
    head.dataset.id = item.id;
    head.setAttribute("aria-expanded", state.openId === item.id ? "true" : "false");
    head.setAttribute("aria-controls", `body-${item.id}`);

    const media = buildStoryMedia(item);
    const copy = node("div", "news-head-copy");
    const kickers = node("div", "news-kickers");
    kickers.append(node("span", `region-badge ${item.region}`, item.region === "iran" ? "ایران" : "جهان"));
    if (isNew(item)) kickers.append(node("span", "new-badge", "جدید"));
    kickers.append(node("span", "feed-badge", item.feed));
    copy.append(kickers, node("h3", "", item.title));

    const submeta = node("div", "news-card-submeta");
    submeta.append(metaItem("clock", item.published ? relativeTime(item.published) : "زمان نامشخص"));
    submeta.append(metaItem("eye", `${faNumber(item.views)} بازدید`));
    submeta.append(metaItem("message", `${faNumber(discussionCount(item))} نظر`));
    copy.append(submeta);

    const side = node("div", "news-head-side");
    const rating = node("span", "compact-rating");
    rating.append(node("b", "", "★ "), document.createTextNode(`${faNumber(item.rate_avg, 1)} (${faNumber(item.rate_count)})`));
    const chevron = node("span", "chevron");
    chevron.append(icon("chevron"));
    side.append(rating, chevron);
    head.append(media, copy, side);

    const body = node("div", "news-card-body");
    body.id = `body-${item.id}`;
    body.append(buildStoryTabs(item));
    const mode = state.modes.get(item.id) || "summary";
    const text = node("p", "news-text", mode === "full" && hasUsefulFullText(item) ? item.full_fa : item.summary);
    text.dataset.role = "story-text";
    body.append(text);
    const translationNote = node("p", "translation-note", mode === "full" ? (hasUsefulFullText(item) ? "متن کامل فارسی؛ ترجمه ماشینی ممکن است نیازمند بازبینی باشد." : "متن کامل فارسی با اتصال به سرویس ترجمه آماده می‌شود.") : "خلاصه فارسی تهیه‌شده از محتوای منبع");
    translationNote.dataset.role = "translation-note";
    body.append(translationNote, buildStoryActions(item), buildFeedbackPanel(item));

    article.append(head, body);
    return article;
  }

  function buildStoryMedia(item) {
    const media = node("span", `story-media ${sourceClass(item.source)}`);
    if (item.image) {
      const image = document.createElement("img");
      image.src = item.image;
      image.alt = "";
      image.loading = "lazy";
      image.decoding = "async";
      image.referrerPolicy = "no-referrer";
      image.addEventListener("error", () => renderMediaFallback(media, item), { once: true });
      media.append(image);
    } else {
      renderMediaFallback(media, item);
    }
    return media;
  }

  function renderMediaFallback(media, item) {
    media.replaceChildren();
    media.append(node("span", "source-initials", sourceInitials(item.source)), icon("home"));
  }

  function metaItem(iconName, text) {
    const span = node("span");
    span.append(icon(iconName), document.createTextNode(text));
    return span;
  }

  function buildStoryTabs(item) {
    const tabs = node("div", "news-tabs");
    tabs.setAttribute("role", "tablist");
    const selected = state.modes.get(item.id) || "summary";
    const summary = node("button", selected === "summary" ? "active" : "", "خلاصه");
    summary.type = "button";
    summary.dataset.action = "mode";
    summary.dataset.mode = "summary";
    summary.dataset.id = item.id;
    summary.setAttribute("role", "tab");
    summary.setAttribute("aria-selected", selected === "summary" ? "true" : "false");
    const full = node("button", selected === "full" ? "active" : "", "متن کامل");
    full.type = "button";
    full.dataset.action = "mode";
    full.dataset.mode = "full";
    full.dataset.id = item.id;
    full.setAttribute("role", "tab");
    full.setAttribute("aria-selected", selected === "full" ? "true" : "false");
    tabs.append(summary, full);
    return tabs;
  }

  function buildStoryActions(item) {
    const actions = node("div", "story-actions");
    actions.append(actionButton("مطالعه", "reader", item.id, "book"));
    const save = actionButton(state.saved.has(item.id) ? "ذخیره شد" : "ذخیره", "save", item.id, "bookmark", state.saved.has(item.id) ? "saved" : "");
    save.setAttribute("aria-pressed", state.saved.has(item.id) ? "true" : "false");
    actions.append(save);

    const shareCluster = node("div", "share-cluster");
    shareCluster.append(actionButton("اشتراک", "share-menu", item.id, "share"), buildShareMenu(item));
    actions.append(shareCluster);
    actions.append(actionButton("گزارش اشکال", "report", item.id, "flag"));

    const source = node("a", "source-link");
    source.href = item.url;
    source.target = "_blank";
    source.rel = "noopener noreferrer";
    source.append(icon("external"), node("span", "", "منبع اصلی"));
    actions.append(source);
    return actions;
  }

  function buildShareMenu(item) {
    const menu = node("div", "share-menu");
    menu.dataset.menuFor = item.id;
    const url = encodeURIComponent(item.url);
    const title = encodeURIComponent(item.title);
    const links = [
      ["واتساپ", `https://wa.me/?text=${title}%20${url}`],
      ["تلگرام", `https://t.me/share/url?url=${url}&text=${title}`],
      ["ایکس", `https://twitter.com/intent/tweet?text=${title}&url=${url}`]
    ];
    links.forEach(([label, href]) => {
      const link = node("a", "", label);
      link.href = href;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      menu.append(link);
    });
    menu.append(actionButton("کپی پیوند", "copy", item.id, "copy"));
    return menu;
  }

  function getFeedback(item) {
    const local = state.feedback[item.id] || {};
    return {
      average: Number(local.average ?? item.rate_avg ?? 0),
      count: Number(local.count ?? item.rate_count ?? 0),
      ownRating: Number(local.ownRating || 0),
      comments: Array.isArray(local.comments) ? local.comments.slice(0, 25) : []
    };
  }

  function buildFeedbackPanel(item) {
    const feedback = getFeedback(item);
    const panel = node("section", "feedback-panel");
    panel.dataset.feedbackFor = item.id;
    panel.setAttribute("aria-label", "امتیاز و نظر کاربران");

    const ratingBox = node("div", "rating-box");
    ratingBox.append(node("h4", "", "این خبر چقدر مفید بود؟"));
    const summary = node("div", "rating-summary");
    summary.append(node("strong", "", faNumber(feedback.average, 1)), node("span", "", `از ۵ · ${faNumber(feedback.count)} رأی`));
    ratingBox.append(summary);
    const stars = node("div", "star-row");
    stars.setAttribute("role", "group");
    stars.setAttribute("aria-label", "امتیاز از یک تا پنج");
    for (let value = 1; value <= 5; value += 1) {
      const star = node("button", value <= feedback.ownRating ? "active" : "", "★");
      star.type = "button";
      star.dataset.action = "rate";
      star.dataset.id = item.id;
      star.dataset.value = String(value);
      star.setAttribute("aria-label", `${faNumber(value)} ستاره`);
      star.setAttribute("aria-pressed", value === feedback.ownRating ? "true" : "false");
      stars.append(star);
    }
    ratingBox.append(stars, node("p", "rating-help", "ثبت امتیاز بدون انتشار نام انجام می‌شود."));

    const commentsBox = node("div", "comments-box");
    commentsBox.append(node("h4", "", "نظر یا تحلیل شما"));
    commentsBox.append(buildCommentForm(item.id));
    panel.append(ratingBox, commentsBox);

    const list = node("div", "comments-list");
    if (feedback.comments.length) {
      feedback.comments.slice(0, 6).forEach((comment) => list.append(buildComment(comment)));
    } else {
      list.append(node("p", "empty-comments", state.feedbackLoaded.has(item.id) ? "هنوز نظری ثبت نشده است." : "نظرها با بازشدن خبر همگام می‌شوند."));
    }
    panel.append(list);
    return panel;
  }

  function buildCommentForm(id) {
    const form = node("form", "comment-form");
    form.dataset.id = id;
    form.dataset.createdAt = String(Date.now());

    const nameLabel = node("label");
    nameLabel.append(node("span", "", "نام (اختیاری)"));
    const nameInput = document.createElement("input");
    nameInput.name = "name";
    nameInput.maxLength = 60;
    nameInput.autocomplete = "name";
    nameLabel.append(nameInput);

    const commentLabel = node("label");
    commentLabel.append(node("span", "", "متن نظر"));
    const textarea = document.createElement("textarea");
    textarea.name = "comment";
    textarea.required = true;
    textarea.maxLength = 800;
    textarea.placeholder = "دیدگاه خود را محترمانه بنویسید…";
    commentLabel.append(textarea);

    const honeypotLabel = node("label", "honeypot", "وب‌سایت");
    const honeypot = document.createElement("input");
    honeypot.name = "website";
    honeypot.tabIndex = -1;
    honeypot.autocomplete = "off";
    honeypotLabel.append(honeypot);

    const submit = node("button", "", "ثبت نظر");
    submit.type = "submit";
    form.append(nameLabel, commentLabel, honeypotLabel, submit);
    return form;
  }

  function buildComment(comment) {
    const article = node("article", "comment-item");
    const header = node("header");
    header.append(node("strong", "", String(comment.name || "کاربر رادار")), node("time", "", comment.created_at ? relativeTime(comment.created_at) : "تازه"));
    article.append(header, node("p", "", String(comment.comment || comment.text || "")));
    return article;
  }

  function updateFeedbackPanel(id) {
    const item = state.items.find((entry) => entry.id === id);
    const current = $(`[data-feedback-for="${CSS.escape(id)}"]`, els.grid);
    if (item && current) current.replaceWith(buildFeedbackPanel(item));
  }

  async function loadFeedback(id) {
    if (state.feedbackLoaded.has(id)) return;
    state.feedbackLoaded.add(id);
    try {
      const data = await fetchJSON(`${API.feedback}?id=${encodeURIComponent(id)}`);
      const current = state.feedback[id] || {};
      state.feedback[id] = {
        ...current,
        average: Number(data.average ?? data.rate_avg ?? current.average ?? 0),
        count: Number(data.count ?? data.rate_count ?? current.count ?? 0),
        comments: Array.isArray(data.comments) ? data.comments.slice(0, 25) : (current.comments || [])
      };
      syncItemFeedback(id);
      persistFeedback();
    } catch {
      // Local feedback remains available when the server endpoint is absent.
    }
    updateFeedbackPanel(id);
  }

  async function submitRating(id, value) {
    if (!Number.isInteger(value) || value < 1 || value > 5) return;
    const current = getFeedback(state.items.find((item) => item.id === id));
    const oldRating = current.ownRating;
    let nextCount = current.count;
    let nextAverage = current.average;
    if (oldRating) {
      nextAverage = nextCount ? ((nextAverage * nextCount) - oldRating + value) / nextCount : value;
    } else {
      nextAverage = ((nextAverage * nextCount) + value) / (nextCount + 1);
      nextCount += 1;
    }
    state.feedback[id] = { ...(state.feedback[id] || {}), average: nextAverage, count: nextCount, ownRating: value, comments: current.comments };
    syncItemFeedback(id);
    persistFeedback();
    updateFeedbackPanel(id);

    try {
      const data = await fetchJSON(API.feedback, { method: "POST", body: JSON.stringify({ news_id: id, rating: value }) });
      state.feedback[id] = {
        ...state.feedback[id],
        average: Number(data.average ?? data.rate_avg ?? nextAverage),
        count: Number(data.count ?? data.rate_count ?? nextCount)
      };
      syncItemFeedback(id);
      persistFeedback();
      updateFeedbackPanel(id);
      toast("امتیاز شما ثبت شد.", "success");
    } catch {
      toast("امتیاز فعلاً روی این دستگاه ذخیره شد؛ همگام‌سازی سرور در دسترس نیست.");
    }
  }

  async function submitComment(form) {
    const id = form.dataset.id;
    const formData = new FormData(form);
    const comment = String(formData.get("comment") || "").trim();
    const name = String(formData.get("name") || "").trim().slice(0, 60);
    const honeypot = String(formData.get("website") || "");
    const age = Date.now() - Number(form.dataset.createdAt || Date.now());
    if (honeypot || age < 1_000) return;
    if (comment.length < 3) {
      toast("متن نظر باید دست‌کم سه نویسه باشد.", "error");
      return;
    }

    const lastSubmit = Number(storage.get(`radar_comment_last_${id}`, "0"));
    if (Date.now() - lastSubmit < COMMENT_RATE_LIMIT) {
      const seconds = Math.ceil((COMMENT_RATE_LIMIT - (Date.now() - lastSubmit)) / 1000);
      toast(`برای ثبت نظر بعدی ${faNumber(seconds)} ثانیه صبر کنید.`, "error");
      return;
    }

    const button = $("button[type='submit']", form);
    button.disabled = true;
    const newComment = { name: name || "کاربر رادار", comment: comment.slice(0, 800), created_at: new Date().toISOString() };
    const current = getFeedback(state.items.find((item) => item.id === id));

    try {
      const data = await fetchJSON(API.feedback, { method: "POST", body: JSON.stringify({ news_id: id, name, comment: newComment.comment }) });
      const comments = Array.isArray(data.comments) ? data.comments : [data.comment || newComment, ...current.comments];
      state.feedback[id] = { ...(state.feedback[id] || {}), comments: comments.slice(0, 25) };
      toast("نظر شما ثبت شد.", "success");
    } catch {
      state.feedback[id] = { ...(state.feedback[id] || {}), comments: [newComment, ...current.comments].slice(0, 25) };
      toast("نظر فعلاً روی این دستگاه ذخیره شد؛ اتصال API برقرار نیست.");
    } finally {
      storage.set(`radar_comment_last_${id}`, String(Date.now()));
      syncItemFeedback(id);
      persistFeedback();
      updateFeedbackPanel(id);
    }
  }

  function syncItemFeedback(id) {
    const item = state.items.find((entry) => entry.id === id);
    const feedback = state.feedback[id];
    if (!item || !feedback) return;
    item.rate_avg = Number(feedback.average ?? item.rate_avg ?? 0);
    item.rate_count = Number(feedback.count ?? item.rate_count ?? 0);
    item.comment_count = Array.isArray(feedback.comments) ? feedback.comments.length : item.comment_count;
  }

  function persistFeedback() {
    storage.setJSON("radar_feedback_v4", state.feedback);
  }

  async function setMode(id, mode) {
    const item = state.items.find((entry) => entry.id === id);
    if (!item) return;
    state.modes.set(id, mode);
    const card = $(`.news-card[data-id="${CSS.escape(id)}"]`, els.grid);
    if (!card) return;
    $$(".news-tabs button", card).forEach((button) => {
      const selected = button.dataset.mode === mode;
      button.classList.toggle("active", selected);
      button.setAttribute("aria-selected", selected ? "true" : "false");
    });
    const text = $("[data-role='story-text']", card);
    const note = $("[data-role='translation-note']", card);
    if (mode === "summary") {
      text.textContent = item.summary;
      note.textContent = "خلاصه فارسی تهیه‌شده از محتوای منبع";
      return;
    }
    if (hasUsefulFullText(item)) {
      text.textContent = item.full_fa;
      note.textContent = "متن کامل فارسی؛ ترجمه ماشینی ممکن است نیازمند بازبینی باشد.";
      return;
    }
    text.textContent = "در حال آماده‌سازی متن کامل فارسی…";
    note.textContent = "در حال اتصال به سرویس ترجمه";
    const translated = await requestFullText(item);
    text.textContent = translated || item.summary;
    note.textContent = translated ? "متن کامل فارسی؛ ترجمه ماشینی ممکن است نیازمند بازبینی باشد." : "سرویس ترجمه در دسترس نبود؛ خلاصه خبر نمایش داده شد.";
  }

  async function requestFullText(item) {
    if (hasUsefulFullText(item)) return item.full_fa;
    try {
      const data = await fetchJSON(`${API.translate}?id=${encodeURIComponent(item.id)}`, {}, 14_000);
      const text = String(data.text_fa || data.full_fa || "").trim();
      if (text) {
        item.full_fa = text;
        return text;
      }
    } catch {
      // The summary is retained as a transparent fallback.
    }
    return "";
  }

  function toggleCard(id, { scroll = false } = {}) {
    const target = $(`.news-card[data-id="${CSS.escape(id)}"]`, els.grid);
    if (!target) {
      state.query = "";
      state.filter = "all";
      state.savedOnly = false;
      state.visible = state.items.length;
      els.search.value = "";
      syncFilterControls();
      renderNews();
      window.setTimeout(() => toggleCard(id, { scroll: true }), 0);
      return;
    }
    const opening = state.openId !== id || !target.classList.contains("open");
    $$(".news-card.open", els.grid).forEach((card) => {
      card.classList.remove("open");
      $(".news-card-head", card)?.setAttribute("aria-expanded", "false");
    });
    state.openId = opening ? id : null;
    if (opening) {
      target.classList.add("open");
      $(".news-card-head", target)?.setAttribute("aria-expanded", "true");
      trackView(id);
      void loadFeedback(id);
      if (scroll) target.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }

  async function trackView(id) {
    if (state.viewedSession.has(id)) return;
    state.viewedSession.add(id);
    const item = state.items.find((entry) => entry.id === id);
    if (!item) return;
    const next = Math.max(Number(state.localViews[id] || 0), Number(item.views || 0)) + 1;
    state.localViews[id] = next;
    item.views = next;
    storage.setJSON("radar_views_v4", state.localViews);
    try {
      const data = await fetchJSON(API.view, { method: "POST", body: JSON.stringify({ id }) });
      if (Number.isFinite(Number(data.views))) {
        item.views = Number(data.views);
        state.localViews[id] = item.views;
        storage.setJSON("radar_views_v4", state.localViews);
      }
    } catch {
      // A local counter keeps the static edition useful without fabricating server totals.
    }
    renderTopStories();
  }

  function renderSignals() {
    const sorted = state.items.slice().sort((a, b) => dateValue(b) - dateValue(a));
    const iran = sorted.filter((item) => item.region === "iran").slice(0, 2);
    const world = sorted.filter((item) => item.region === "world").slice(0, 2);
    const signals = [...iran, ...world].sort((a, b) => dateValue(b) - dateValue(a)).slice(0, 4);
    els.signalRail.replaceChildren();
    signals.forEach((item) => {
      const card = node("article", `signal-card ${item.region}`);
      card.dataset.id = item.id;
      const meta = node("div", "signal-meta");
      meta.append(node("span", "signal-region", item.region === "iran" ? "ایران" : "جهان"), node("time", "", item.published ? relativeTime(item.published) : "—"));
      card.append(meta, node("h3", "", item.title));
      const button = node("button", "", "مشاهده خبر ←");
      button.type = "button";
      button.dataset.action = "open-signal";
      button.dataset.id = item.id;
      card.append(button);
      els.signalRail.append(card);
    });
  }

  function renderTopStories() {
    const ranked = state.items.filter((item) => item.views > 0).sort((a, b) => b.views - a.views).slice(0, 3);
    els.topStories.hidden = ranked.length === 0;
    els.topStoryGrid.replaceChildren();
    ranked.forEach((item, index) => {
      const card = node("article", "top-story-card");
      card.append(node("span", "rank", faNumber(index + 1)), node("h3", "", item.title));
      const button = node("button", "", `${faNumber(item.views)} بازدید · مشاهده خبر`);
      button.type = "button";
      button.dataset.action = "open-top";
      button.dataset.id = item.id;
      card.append(button);
      els.topStoryGrid.append(card);
    });
  }

  async function loadMarket() {
    if (["file:", "content:"].includes(window.location.protocol)) {
      renderFallbackMarket();
      return;
    }
    try {
      const data = await fetchJSON(API.market);
      if (!data || !Array.isArray(data.indicators)) throw new Error("Invalid market payload");
      renderMarketData(data);
    } catch {
      renderFallbackMarket();
    }
  }

  function renderMarketData(data) {
    els.analysisMode.textContent = "بر پایه داده اقتصادی برخط";
    els.analysisTitle.textContent = String(data.title || "تصویر روز بازار مسکن");
    els.analysisBody.textContent = String(data.summary || data.analysis || "جمع‌بندی تحلیلی هنوز از API دریافت نشده است.");
    renderAnalysisTags(Array.isArray(data.tags) ? data.tags : []);
    els.marketUpdated.textContent = data.updated_at ? `به‌روزرسانی شاخص‌ها: ${faDate(data.updated_at)}` : "شاخص‌های برخط بازار";
    els.indicatorGrid.replaceChildren();
    data.indicators.slice(0, 4).forEach((indicator, index) => els.indicatorGrid.append(buildIndicator({
      label: indicator.label,
      value: indicator.value,
      unit: indicator.unit,
      change: indicator.change,
      source: indicator.source,
      accent: indicator.trend === "up" ? "green" : indicator.trend === "down" ? "red" : ["gold", "blue", "green", "red"][index]
    })));
  }

  function renderFallbackMarket() {
    if (!state.items.length) return;
    const dayAgo = Date.now() - 86_400_000;
    const recent = state.items.filter((item) => dateValue(item) >= dayAgo);
    const iranCount = state.items.filter((item) => item.region === "iran").length;
    const translated = state.items.filter(hasUsefulFullText).length;
    const newest = state.items.slice().sort((a, b) => dateValue(b) - dateValue(a))[0];
    const recentFeeds = countTopValues((recent.length ? recent : state.items.slice(0, 12)).map((item) => item.feed), 2);

    els.analysisMode.textContent = "بر پایه رصد خبری؛ نه داده قیمت";
    els.analysisTitle.textContent = recent.length
      ? `${faNumber(recent.length)} خبر تازه در شبانه‌روز اخیر روی رادار قرار گرفت`
      : "تصویر روز بر پایه آخرین جریان خبرهای موجود";
    const feedText = recentFeeds.length ? recentFeeds.map(([label]) => label.replace(/^.*—\s*/, "")).join(" و ") : "بازار مسکن";
    els.analysisBody.textContent = `بیشترین تمرکز جریان موجود بر «${feedText}» است. سهم خبرهای ایران ${faNumber(iranCount)} مورد از ${faNumber(state.items.length)} خبر است. برای تصمیم‌گیری، تاریخ انتشار و منبع اصلی هر خبر را نیز بررسی کنید.`;
    renderAnalysisTags([
      `${faNumber(recent.length)} خبر در ۲۴ ساعت`,
      `${faNumber(iranCount)} خبر ایران`,
      `${faNumber(translated)} متن کامل فارسی`
    ]);
    els.marketUpdated.textContent = newest?.published ? `تازه‌ترین سیگنال: ${faDate(newest.published)}` : "نسخه تحلیلی آفلاین";
    els.indicatorGrid.replaceChildren();
    [
      { label: "کل خبرهای رادار", value: state.items.length, unit: "خبر", change: "پوشش فعلی", source: "خوراک خبری", accent: "gold" },
      { label: "شبانه‌روز اخیر", value: recent.length, unit: "خبر", change: "جریان تازه", source: "محاسبه از زمان انتشار", accent: "green" },
      { label: "پوشش ایران", value: iranCount, unit: "خبر", change: `${Math.round((iranCount / Math.max(state.items.length, 1)) * 100)}٪`, source: "دسته‌بندی منطقه‌ای", accent: "blue" },
      { label: "متن کامل فارسی", value: translated, unit: "خبر", change: `${Math.round((translated / Math.max(state.items.length, 1)) * 100)}٪`, source: "داده فعلی ترجمه", accent: "red" }
    ].forEach((indicator) => els.indicatorGrid.append(buildIndicator(indicator)));
  }

  function buildIndicator(indicator) {
    const card = node("article", `indicator-card accent-${indicator.accent || "gold"}`);
    const top = node("div", "indicator-top");
    top.append(node("span", "", String(indicator.label || "شاخص")), node("span", "indicator-change", String(indicator.change ?? "—")));
    const value = node("div", "indicator-value");
    value.append(node("strong", "", typeof indicator.value === "number" ? faNumber(indicator.value, 2) : String(indicator.value ?? "—")), node("small", "", String(indicator.unit || "")));
    card.append(top, value, node("span", "indicator-source", String(indicator.source || "منبع API بازار")));
    return card;
  }

  function renderAnalysisTags(tags) {
    els.analysisTags.replaceChildren();
    tags.slice(0, 4).forEach((tag) => els.analysisTags.append(node("span", "", String(tag))));
  }

  function countTopValues(values, limit) {
    const counts = new Map();
    values.filter(Boolean).forEach((value) => counts.set(value, (counts.get(value) || 0) + 1));
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).slice(0, limit);
  }

  function dayKey(date) {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "";
    const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tehran", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
    const get = (type) => parts.find((part) => part.type === type)?.value || "";
    return `${get("year")}-${get("month")}-${get("day")}`;
  }

  function renderWeekChart() {
    const days = [];
    for (let offset = 6; offset >= 0; offset -= 1) {
      const date = new Date(Date.now() - offset * 86_400_000);
      days.push({ date, key: dayKey(date), count: 0 });
    }
    state.items.forEach((item) => {
      const date = new Date(item.published);
      const day = days.find((entry) => entry.key === dayKey(date));
      if (day) day.count += 1;
    });
    const max = Math.max(1, ...days.map((day) => day.count));
    const total = days.reduce((sum, day) => sum + day.count, 0);
    els.weekTotal.textContent = `${faNumber(total)} خبر`;
    els.weekChart.replaceChildren();
    days.forEach((day) => {
      const button = node("button", "chart-column");
      button.type = "button";
      const label = new Intl.DateTimeFormat("fa-IR", { weekday: "narrow", timeZone: "Asia/Tehran" }).format(day.date);
      button.setAttribute("aria-label", `${new Intl.DateTimeFormat("fa-IR", { weekday: "long", month: "long", day: "numeric", timeZone: "Asia/Tehran" }).format(day.date)}: ${faNumber(day.count)} خبر`);
      button.title = `${faNumber(day.count)} خبر`;
      const bar = node("i", `chart-height-${Math.round((day.count / max) * 10)}`);
      button.append(bar, node("span", "", label));
      button.addEventListener("keydown", chartKeydown);
      els.weekChart.append(button);
    });
  }

  function chartKeydown(event) {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    const bars = $$(".chart-column", els.weekChart);
    const index = bars.indexOf(event.currentTarget);
    let next = index;
    if (event.key === "ArrowLeft") next = Math.min(bars.length - 1, index + 1);
    if (event.key === "ArrowRight") next = Math.max(0, index - 1);
    if (event.key === "Home") next = 0;
    if (event.key === "End") next = bars.length - 1;
    event.preventDefault();
    bars[next]?.focus();
  }

  function openReader(id) {
    const item = state.items.find((entry) => entry.id === id);
    if (!item) return;
    state.readerItem = item;
    els.readerSource.replaceChildren(node("span", sourceClass(item.source), sourceInitials(item.source)), node("span", "", item.source_fa || item.source));
    els.readerTitle.textContent = item.title;
    els.readerMeta.textContent = `${item.region === "iran" ? "ایران" : "جهان"} · ${item.published ? faDate(item.published) : "زمان نامشخص"} · ${faNumber(item.views)} بازدید`;
    els.readerBody.textContent = hasUsefulFullText(item) ? item.full_fa : item.summary;
    renderReaderActions(item);
    showDialog(els.reader);
    trackView(id);
    if (!hasUsefulFullText(item)) {
      void requestFullText(item).then((text) => {
        if (text && state.readerItem?.id === item.id) els.readerBody.textContent = text;
      });
    }
  }

  function renderReaderActions(item) {
    els.readerActions.replaceChildren();
    const source = node("a", "", "مشاهده منبع اصلی");
    source.href = item.url;
    source.target = "_blank";
    source.rel = "noopener noreferrer";
    els.readerActions.append(source);
    const shares = [
      ["واتساپ", `https://wa.me/?text=${encodeURIComponent(`${item.title} ${item.url}`)}`],
      ["تلگرام", `https://t.me/share/url?url=${encodeURIComponent(item.url)}&text=${encodeURIComponent(item.title)}`],
      ["ایکس", `https://twitter.com/intent/tweet?text=${encodeURIComponent(item.title)}&url=${encodeURIComponent(item.url)}`]
    ];
    shares.forEach(([label, href]) => {
      const link = node("a", "", label);
      link.href = href;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      els.readerActions.append(link);
    });
    els.readerActions.append(actionButton("کپی پیوند", "reader-copy", item.id, "copy"));
  }

  function showDialog(dialog) {
    if (!dialog.open) dialog.showModal();
    document.body.classList.add("dialog-open");
  }

  function closeDialog(dialog) {
    if (dialog?.open) dialog.close();
    if (!$("dialog[open]")) document.body.classList.remove("dialog-open");
  }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      toast("پیوند کپی شد.", "success");
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.setAttribute("readonly", "");
      textarea.className = "honeypot";
      document.body.append(textarea);
      textarea.select();
      const copied = document.execCommand("copy");
      textarea.remove();
      toast(copied ? "پیوند کپی شد." : "کپی خودکار ممکن نشد.", copied ? "success" : "error");
    }
  }

  function toggleSave(id) {
    if (state.saved.has(id)) state.saved.delete(id);
    else state.saved.add(id);
    storage.setJSON("radar_saved_v4", Array.from(state.saved));
    updateSavedCount();
    if (state.savedOnly) renderNews();
    else {
      const card = $(`.news-card[data-id="${CSS.escape(id)}"]`, els.grid);
      const button = $(`[data-action="save"][data-id="${CSS.escape(id)}"]`, card);
      if (button) {
        const saved = state.saved.has(id);
        button.classList.toggle("saved", saved);
        button.setAttribute("aria-pressed", saved ? "true" : "false");
        $("span", button).textContent = saved ? "ذخیره شد" : "ذخیره";
      }
    }
    toast(state.saved.has(id) ? "خبر ذخیره شد." : "خبر از ذخیره‌شده‌ها حذف شد.", "success");
  }

  function updateSavedCount() {
    els.savedCount.textContent = faNumber(state.saved.size);
    els.savedOnly.setAttribute("aria-pressed", state.savedOnly ? "true" : "false");
  }

  function updateActiveFilter() {
    const parts = [];
    if (state.query) parts.push(`جستجو: «${state.query}»`);
    if (state.filter !== "all") parts.push(state.filter === "iran" ? "فقط ایران" : "فقط جهان");
    if (state.savedOnly) parts.push("فقط ذخیره‌شده‌ها");
    els.activeFilter.hidden = parts.length === 0;
    els.activeFilterText.textContent = parts.join(" · ");
  }

  function resetFilters() {
    state.query = "";
    state.filter = "all";
    state.savedOnly = false;
    state.visible = PAGE_SIZE;
    els.search.value = "";
    els.clearSearch.hidden = true;
    syncFilterControls();
    renderNews();
  }

  function syncFilterControls() {
    $$('[data-filter]').forEach((button) => {
      const active = button.dataset.filter === state.filter;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", active ? "true" : "false");
    });
    els.savedOnly.setAttribute("aria-pressed", state.savedOnly ? "true" : "false");
  }

  function updateConnection(online, text) {
    els.connectionPill.classList.toggle("offline", !online);
    els.connectionText.textContent = text || (online ? "رادار برخط" : "حالت آفلاین");
  }

  function toast(message, type = "") {
    const item = node("div", `toast${type ? ` ${type}` : ""}`, message);
    els.toastRegion.append(item);
    window.setTimeout(() => item.remove(), 4_500);
  }

  async function refreshNews() {
    if (state.refreshInProgress) return;
    state.refreshInProgress = true;
    els.refresh.disabled = true;
    els.refresh.classList.add("loading");
    $(".button-label", els.refresh).textContent = "در حال برداشت…";
    let triggered = false;
    try {
      await fetchJSON(API.refresh, { method: "POST", body: JSON.stringify({}) }, 12_000);
      triggered = true;
    } catch {
      // Static deployments can still reload their packaged cache.
    }
    await loadNews({ silent: true });
    els.refresh.disabled = false;
    els.refresh.classList.remove("loading");
    $(".button-label", els.refresh).textContent = "برداشت تازه";
    state.refreshInProgress = false;
    toast(triggered ? "درخواست برداشت تازه انجام شد." : "نسخه موجود بازخوانی شد؛ API برداشت در دسترس نیست.", triggered ? "success" : "");
  }

  function openProperty(platform) {
    const query = String($("#propertyQuery").value || "رویان ویلا").trim();
    const kind = $("#propertyType").value;
    const encoded = encodeURIComponent(query);
    let url;
    if (platform === "divar") {
      const category = kind === "rent" ? "rent-residential" : "buy-residential";
      url = `https://divar.ir/s/iran/${category}?q=${encoded}`;
    } else {
      const category = kind === "rent" ? "%D8%B1%D9%87%D9%86-%D8%A7%D8%AC%D8%A7%D8%B1%D9%87" : "%D9%81%D8%B1%D9%88%D8%B4";
      url = `https://www.sheypoor.com/s/iran/%D8%A7%D9%85%D9%84%D8%A7%DA%A9/${category}?q=${encoded}`;
    }
    const opened = window.open(url, "_blank", "noopener,noreferrer");
    if (opened) opened.opener = null;
  }

  async function submitNewsletter(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const emailInput = $("#newsletterEmail");
    const consent = $("#newsletterConsent");
    const message = $("#newsletterMessage");
    message.className = "form-message";
    if (!emailInput.validity.valid) {
      message.textContent = "نشانی ایمیل معتبر وارد کنید.";
      message.classList.add("error");
      emailInput.focus();
      return;
    }
    if (!consent.checked) {
      message.textContent = "برای عضویت، موافقت با دریافت خبرنامه لازم است.";
      message.classList.add("error");
      consent.focus();
      return;
    }
    const button = $("button[type='submit']", form);
    button.disabled = true;
    button.classList.add("loading");
    try {
      await fetchJSON(API.newsletter, { method: "POST", body: JSON.stringify({ email: emailInput.value.trim(), consent: true }) });
      message.textContent = "عضویت شما ثبت شد؛ پوشه ورودی ایمیل را بررسی کنید.";
      message.classList.add("success");
      form.reset();
    } catch {
      storage.set("radar_newsletter_pending", emailInput.value.trim());
      message.textContent = "API خبرنامه در این نسخه نمایشی متصل نیست؛ درخواست به‌صورت محلی در انتظار همگام‌سازی ماند.";
      message.classList.add("error");
    } finally {
      button.disabled = false;
      button.classList.remove("loading");
    }
  }

  function openReport(id) {
    $("#reportNewsId").value = id;
    $("#reportNote").value = "";
    $("#reportMessage").textContent = "";
    showDialog(els.report);
  }

  async function submitReport(event) {
    event.preventDefault();
    const id = $("#reportNewsId").value;
    const type = $("#reportType").value;
    const note = $("#reportNote").value.trim().slice(0, 500);
    const message = $("#reportMessage");
    try {
      await fetchJSON(API.report, { method: "POST", body: JSON.stringify({ news_id: id, type, note }) });
      message.textContent = "گزارش شما برای بررسی ارسال شد.";
      message.className = "form-message success";
      window.setTimeout(() => closeDialog(els.report), 900);
    } catch {
      const pending = storage.getJSON("radar_pending_reports_v4", []);
      pending.push({ news_id: id, type, note, created_at: new Date().toISOString() });
      storage.setJSON("radar_pending_reports_v4", pending.slice(-20));
      message.textContent = "اتصال سرور برقرار نیست؛ گزارش روی این دستگاه در صف همگام‌سازی قرار گرفت.";
      message.className = "form-message error";
    }
  }

  function initTheme() {
    const saved = storage.get("radar_theme_v4", "auto");
    const theme = ["auto", "dark", "light"].includes(saved) ? saved : "auto";
    document.documentElement.dataset.theme = theme;
    updateThemeButton(theme);
  }

  function cycleTheme() {
    const current = document.documentElement.dataset.theme || "auto";
    const next = current === "auto" ? "dark" : current === "dark" ? "light" : "auto";
    document.documentElement.dataset.theme = next;
    storage.set("radar_theme_v4", next);
    updateThemeButton(next);
  }

  function updateThemeButton(theme) {
    const labels = { auto: "پوسته خودکار", dark: "پوسته تیره", light: "پوسته روشن" };
    const button = $("#themeToggle");
    button.title = labels[theme];
    button.setAttribute("aria-label", `${labels[theme]}؛ برای تغییر کلیک کنید`);
  }

  function handleGridClick(event) {
    const target = event.target.closest("[data-action]");
    if (!target) return;
    const { action, id } = target.dataset;
    if (action === "toggle") toggleCard(id);
    if (action === "mode") void setMode(id, target.dataset.mode);
    if (action === "reader") openReader(id);
    if (action === "save") toggleSave(id);
    if (action === "report") openReport(id);
    if (action === "rate") void submitRating(id, Number(target.dataset.value));
    if (action === "copy") {
      const item = state.items.find((entry) => entry.id === id);
      if (item) void copyText(item.url);
    }
    if (action === "share-menu") {
      event.stopPropagation();
      const menu = target.parentElement.querySelector(".share-menu");
      const opening = !menu.classList.contains("open");
      $$(".share-menu.open").forEach((open) => open.classList.remove("open"));
      menu.classList.toggle("open", opening);
      if (navigator.share && event.pointerType && event.pointerType !== "mouse") {
        const item = state.items.find((entry) => entry.id === id);
        navigator.share({ title: item.title, text: item.title, url: item.url }).catch(() => {});
      }
    }
  }

  function handleDocumentClick(event) {
    if (!event.target.closest(".share-cluster")) $$(".share-menu.open").forEach((menu) => menu.classList.remove("open"));
    const signal = event.target.closest("[data-action='open-signal'], [data-action='open-top']");
    if (signal) {
      document.querySelector("#news")?.scrollIntoView({ behavior: "smooth", block: "start" });
      window.setTimeout(() => toggleCard(signal.dataset.id, { scroll: true }), 350);
    }
    const close = event.target.closest("[data-close]");
    if (close) closeDialog(document.getElementById(close.dataset.close));
    const readerCopy = event.target.closest("[data-action='reader-copy']");
    if (readerCopy && state.readerItem) void copyText(state.readerItem.url);
  }

  function bindEvents() {
    els.grid.addEventListener("click", handleGridClick);
    els.grid.addEventListener("submit", (event) => {
      if (event.target.matches(".comment-form")) {
        event.preventDefault();
        void submitComment(event.target);
      }
    });
    document.addEventListener("click", handleDocumentClick);

    $$('[data-filter]').forEach((button) => button.addEventListener("click", () => {
      state.filter = button.dataset.filter;
      state.visible = PAGE_SIZE;
      syncFilterControls();
      renderNews();
    }));

    els.search.addEventListener("input", () => {
      els.search.parentElement.classList.add("searching");
      els.clearSearch.hidden = !els.search.value;
      window.clearTimeout(state.searchTimer);
      state.searchTimer = window.setTimeout(() => {
        state.query = els.search.value.trim();
        state.visible = PAGE_SIZE;
        renderNews();
        els.search.parentElement.classList.remove("searching");
      }, 180);
    });
    els.clearSearch.addEventListener("click", () => {
      els.search.value = "";
      state.query = "";
      els.clearSearch.hidden = true;
      renderNews();
      els.search.focus();
    });
    els.sort.addEventListener("change", () => {
      state.sort = els.sort.value;
      state.visible = PAGE_SIZE;
      renderNews();
    });
    els.savedOnly.addEventListener("click", () => {
      state.savedOnly = !state.savedOnly;
      state.visible = PAGE_SIZE;
      updateSavedCount();
      renderNews();
      document.querySelector("#news")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    $("#resetFilters").addEventListener("click", resetFilters);
    els.loadMore.addEventListener("click", () => {
      state.visible += PAGE_SIZE;
      renderNews();
    });
    els.refresh.addEventListener("click", () => void refreshNews());
    $("#themeToggle").addEventListener("click", cycleTheme);

    $("#propertyForm").addEventListener("submit", (event) => {
      event.preventDefault();
      openProperty("divar");
    });
    $$("[data-platform]").forEach((button) => button.addEventListener("click", () => openProperty(button.dataset.platform)));
    $("#newsletterForm").addEventListener("submit", submitNewsletter);
    $("#reportForm").addEventListener("submit", submitReport);

    $("#readerPrint").addEventListener("click", () => window.print());
    $("#readerDecrease").addEventListener("click", () => setReaderSize(state.readerSize - 1));
    $("#readerIncrease").addEventListener("click", () => setReaderSize(state.readerSize + 1));
    [els.reader, els.report].forEach((dialog) => dialog.addEventListener("close", () => {
      if (!$("dialog[open]")) document.body.classList.remove("dialog-open");
    }));

    window.addEventListener("scroll", () => els.backTop.classList.toggle("show", window.scrollY > 600), { passive: true });
    els.backTop.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));
    window.addEventListener("online", () => {
      updateConnection(true, state.loadSource === "api" ? "رادار برخط" : "آنلاین؛ نسخه ذخیره‌شده");
      toast("اتصال اینترنت برقرار شد.", "success");
    });
    window.addEventListener("offline", () => {
      updateConnection(false, "حالت آفلاین");
      toast("اتصال قطع شد؛ محتوای ذخیره‌شده در دسترس است.");
    });
  }

  function setReaderSize(value) {
    state.readerSize = Math.max(0, Math.min(2, value));
    els.reader.classList.remove("reader-small", "reader-large");
    if (state.readerSize === 0) els.reader.classList.add("reader-small");
    if (state.readerSize === 2) els.reader.classList.add("reader-large");
  }

  function registerServiceWorker() {
    if (!("serviceWorker" in navigator) || !["http:", "https:"].includes(window.location.protocol)) return;
    window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}), { once: true });
  }

  function init() {
    initTheme();
    bindEvents();
    showSkeletons();
    updateSavedCount();
    updateConnection(navigator.onLine, navigator.onLine ? "در حال اتصال" : "حالت آفلاین");
    registerServiceWorker();
    void loadNews();
    window.setInterval(() => loadNews({ silent: true }), 60 * 60 * 1000);
  }

  init();
})();

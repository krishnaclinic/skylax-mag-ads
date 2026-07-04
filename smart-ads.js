/**
 * Skylax Mag — Smart Ad Management System
 *
 * Auto-optimizes ad placements for maximum revenue while maintaining
 * good user experience. Features: auto-sizing, lazy loading, smart
 * placement, ad rotation, revenue tracking, and exit-intent ads.
 */

(function() {
  'use strict';

  // ─── Default Configuration ───────────────────────────────
  var DEFAULT_CONFIG = {
    adSlots: {
      'header-banner':  { enabled: true, type: 'banner', size: '728x90' },
      'mobile-banner':  { enabled: true, type: 'banner', size: '320x50' },
      'native-banner':  { enabled: true, type: 'native' },
      'in-content-1':   { enabled: true, type: 'banner', size: '300x250' },
      'in-content-2':   { enabled: true, type: 'banner', size: '300x250' },
      'sidebar-top':    { enabled: true, type: 'banner', size: '300x250' },
      'sidebar-sticky': { enabled: true, type: 'banner', size: '160x600', sticky: true },
      'footer-banner':  { enabled: true, type: 'banner', size: '728x90' },
      'footer-mobile':  { enabled: true, type: 'banner', size: '320x50' },
      'exit-intent':    { enabled: true, type: 'banner', size: '300x250' }
    },
    settings: {
      autoOptimize: true,
      maxAdsPerPage: 6,
      minSpacingPx: 300,
      adFrequencyParagraphs: 3,
      lazyLoadThreshold: 200,
      viewabilityThreshold: 50,
      viewabilityTimeMs: 1000,
      abTestEnabled: true,
      abTestMinImpressions: 1000,
      exitIntentEnabled: true,
      exitIntentCooldownHours: 24,
      stickySidebar: true,
      lazyLoading: true,
      revenueTrackingEnabled: true
    }
  };

  // ─── State ───────────────────────────────────────────────
  var config = null;
  var adsLoaded = 0;
  var viewport = { width: 0, height: 0, type: 'desktop' };
  var revenueData = {};
  var observer = null;
  var scrollDepth = 0;

  // ─── Initialization ──────────────────────────────────────

  function init() {
    config = loadConfig();
    detectViewport();
    injectThemeAds();
    setupLazyLoading();
    injectInContentAds();
    setupStickySidebar();
    setupExitIntent();
    setupViewabilityTracking();
    setupRevenueTracking();
    setupAdBlockerDetection();
    window.addEventListener('resize', debounce(onResize, 250));
    window.addEventListener('scroll', debounce(onScroll, 100));
    log('Skylax Ad Manager initialized');
  }

  function loadConfig() {
    try {
      var stored = localStorage.getItem('skylax_ad_config');
      if (stored) return JSON.parse(stored);
    } catch(e) {}
    return JSON.parse(JSON.stringify(DEFAULT_CONFIG));
  }

  function saveConfig() {
    try {
      localStorage.setItem('skylax_ad_config', JSON.stringify(config));
    } catch(e) {}
  }

  // ─── Viewport Detection ──────────────────────────────────

  function detectViewport() {
    viewport.width = window.innerWidth || document.documentElement.clientWidth;
    viewport.height = window.innerHeight || document.documentElement.clientHeight;

    if (viewport.width < 768) {
      viewport.type = 'mobile';
    } else if (viewport.width < 1024) {
      viewport.type = 'tablet';
    } else {
      viewport.type = 'desktop';
    }
  }

  function onResize() {
    detectViewport();
    resizeAllAds();
  }

  function onScroll() {
    scrollDepth = Math.max(scrollDepth, getScrollPercent());
  }

  function getScrollPercent() {
    var h = document.documentElement;
    var b = document.body;
    return (h.scrollTop || b.scrollTop) / ((h.scrollHeight || b.scrollHeight) - h.clientHeight) * 100;
  }

  // ─── Auto-Responsive Ad Sizing ──────────────────────────

  function getOptimalSize(slotConfig) {
    var sizes = slotConfig.sizes || [];
    for (var i = 0; i < sizes.length; i++) {
      var parts = sizes[i].split('x');
      var w = parseInt(parts[0]);
      if (viewport.type === 'mobile' && w <= 320) return sizes[i];
      if (viewport.type === 'tablet' && w <= 468) return sizes[i];
      if (viewport.type === 'desktop') return sizes[i];
    }
    return sizes[sizes.length - 1] || '300x250';
  }

  function resizeAllAds() {
    var slots = document.querySelectorAll('.ad-slot');
    for (var i = 0; i < slots.length; i++) {
      var slotId = slots[i].getAttribute('data-ad-slot');
      if (slotId && config.adSlots[slotId]) {
        var optimalSize = getOptimalSize(config.adSlots[slotId]);
        var parts = optimalSize.split('x');
        slots[i].style.maxWidth = parts[0] + 'px';
        var ins = slots[i].querySelector('ins');
        if (ins) {
          ins.style.width = parts[0] + 'px';
          ins.style.height = parts[1] + 'px';
        }
      }
    }
  }

  // ─── Theme Ad Detection ──────────────────────────────────
  // All banner ads are now placed directly in the Blogger theme XML.
  // This function detects them and registers them for tracking.

  var injectedSlots = {};

  function injectThemeAds() {
    var containers = document.querySelectorAll('.ad-container[data-ad-slot]');
    for (var i = 0; i < containers.length; i++) {
      var slotId = containers[i].getAttribute('data-ad-slot');
      if (slotId && !injectedSlots[slotId]) {
        injectedSlots[slotId] = true;
        adsLoaded++;
        trackImpression(slotId);
        log('Ad detected: ' + slotId);
      }
    }
  }

  // ─── Lazy Loading ────────────────────────────────────────

  function setupLazyLoading() {
    if (!config.settings.lazyLoading) return;

    observer = new IntersectionObserver(function(entries) {
      for (var i = 0; i < entries.length; i++) {
        if (entries[i].isIntersecting) {
          loadAdSlot(entries[i].target);
          observer.unobserve(entries[i].target);
        }
      }
    }, {
      rootMargin: config.settings.lazyLoadThreshold + 'px'
    });

    var slots = document.querySelectorAll('.ad-slot.lazy');
    for (var i = 0; i < slots.length; i++) {
      observer.observe(slots[i]);
    }
  }

  function loadAdSlot(slot) {
    if (slot.classList.contains('loaded')) return;

    var slotId = slot.getAttribute('data-ad-slot');
    if (!slotId || !config.adSlots[slotId] || !config.adSlots[slotId].enabled) return;

    if (adsLoaded >= config.settings.maxAdsPerPage) {
      slot.style.display = 'none';
      return;
    }

    slot.classList.remove('lazy');
    slot.classList.add('loading');

    setTimeout(function() {
      slot.classList.remove('loading');
      slot.classList.add('loaded');
      adsLoaded++;
      trackImpression(slotId);
    }, 300);
  }

  // ─── In-Content Ad Injection ─────────────────────────────

  function injectInContentAds() {
    var postContent = document.querySelector('.post-body, .entry-content, .post-content');
    if (!postContent) return;

    var paragraphs = postContent.querySelectorAll('p');
    var totalParagraphs = paragraphs.length;
    var adsToInject = [];

    if (totalParagraphs < 5) {
      if (config.adSlots['in-content-1'] && config.adSlots['in-content-1'].enabled) {
        adsToInject.push({ slot: 'in-content-1', after: Math.min(2, totalParagraphs - 1) });
      }
    } else if (totalParagraphs < 10) {
      if (config.adSlots['in-content-1'] && config.adSlots['in-content-1'].enabled) {
        adsToInject.push({ slot: 'in-content-1', after: 3 });
      }
      if (config.adSlots['in-content-2'] && config.adSlots['in-content-2'].enabled) {
        adsToInject.push({ slot: 'in-content-2', after: 7 });
      }
    } else {
      if (config.adSlots['in-content-1'] && config.adSlots['in-content-1'].enabled) {
        adsToInject.push({ slot: 'in-content-1', after: 3 });
      }
      if (config.adSlots['in-content-2'] && config.adSlots['in-content-2'].enabled) {
        adsToInject.push({ slot: 'in-content-2', after: 7 });
      }
      if (config.adSlots['in-content-3'] && config.adSlots['in-content-3'].enabled) {
        adsToInject.push({ slot: 'in-content-3', after: 11 });
      }
    }

    for (var i = adsToInject.length - 1; i >= 0; i--) {
      var inject = adsToInject[i];
      if (inject.after < paragraphs.length) {
        var adDiv = createAdSlotElement(inject.slot);
        paragraphs[inject.after].parentNode.insertBefore(adDiv, paragraphs[inject.after].nextSibling);
      }
    }
  }

  function createAdSlotElement(slotId) {
    var div = document.createElement('div');
    div.className = 'ad-slot lazy';
    div.setAttribute('data-ad-slot', slotId);

    var slotConfig = config.adSlots[slotId] || {};
    var optimalSize = getOptimalSize(slotConfig);
    var parts = optimalSize.split('x');

    div.style.maxWidth = parts[0] + 'px';
    div.style.margin = '20px auto';
    div.style.textAlign = 'center';
    div.style.minHeight = '1px';

    div.innerHTML = '<div class="ad-placeholder" style="background:#f5f5f5;border:1px dashed #ddd;border-radius:4px;padding:20px;color:#999;font-size:12px;">Ad Space — ' + optimalSize + '</div>';

    return div;
  }

  // ─── Sticky Sidebar ──────────────────────────────────────

  function setupStickySidebar() {
    if (!config.settings.stickySidebar) return;

    var sidebar = document.querySelector('.sidebar, #sidebar, .widget-area');
    if (!sidebar) return;

    var sidebarAd = sidebar.querySelector('.ad-slot[data-ad-slot="sidebar-sticky"]');
    if (!sidebarAd) return;

    sidebarAd.classList.add('ad-sticky');
  }

  // ─── Exit-Intent ─────────────────────────────────────────

  function setupExitIntent() {
    if (!config.settings.exitIntentEnabled) return;
    if (viewport.type === 'mobile') return;

    var lastFired = parseInt(localStorage.getItem('skylax_exit_intent_time') || '0');
    var cooldown = (config.settings.exitIntentCooldownHours || 24) * 60 * 60 * 1000;
    if (Date.now() - lastFired < cooldown) return;

    document.addEventListener('mouseout', function(e) {
      if (e.clientY < 10 && !e.relatedTarget) {
        showExitIntentAd();
      }
    });
  }

  function showExitIntentAd() {
    if (document.getElementById('exit-intent-overlay')) return;
    localStorage.setItem('skylax_exit_intent_time', Date.now().toString());

    var overlay = document.createElement('div');
    overlay.id = 'exit-intent-overlay';
    overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.7);z-index:99999;display:flex;align-items:center;justify-content:center;';

    var box = document.createElement('div');
    box.style.cssText = 'background:white;border-radius:12px;padding:30px;max-width:400px;text-align:center;position:relative;';

    var closeBtn = document.createElement('button');
    closeBtn.textContent = '\u00D7';
    closeBtn.style.cssText = 'position:absolute;top:10px;right:15px;background:none;border:none;font-size:24px;cursor:pointer;color:#666;';
    closeBtn.onclick = function() { overlay.remove(); };

    var title = document.createElement('h3');
    title.textContent = 'Don\'t miss out!';
    title.style.cssText = 'margin:0 0 15px;color:#00529F;';

    var adSlot = document.createElement('div');
    adSlot.className = 'ad-slot loaded';
    adSlot.setAttribute('data-ad-slot', 'exit-intent');
    adSlot.style.cssText = 'min-height:250px;background:#f5f5f5;border:1px dashed #ddd;border-radius:8px;display:flex;align-items:center;justify-content:center;color:#999;';
    adSlot.innerHTML = 'Ad Space — 300x250';

    box.appendChild(closeBtn);
    box.appendChild(title);
    box.appendChild(adSlot);
    overlay.appendChild(box);
    document.body.appendChild(overlay);

    overlay.addEventListener('click', function(e) {
      if (e.target === overlay) overlay.remove();
    });

    trackImpression('exit-intent');
  }

  // ─── Viewability Tracking ────────────────────────────────

  function setupViewabilityTracking() {
    if (!config.settings.revenueTrackingEnabled) return;

    var viewObserver = new IntersectionObserver(function(entries) {
      for (var i = 0; i < entries.length; i++) {
        var slot = entries[i].target;
        var slotId = slot.getAttribute('data-ad-slot');
        if (!slotId) continue;

        if (entries[i].isIntersecting && entries[i].intersectionRatio >= config.settings.viewabilityThreshold / 100) {
          slot.setAttribute('data-viewable', 'true');
          slot.classList.add('viewable');
          setTimeout(function() {
            if (slot.getAttribute('data-viewable') === 'true') {
              trackViewability(slotId);
            }
          }, config.settings.viewabilityTimeMs);
        } else {
          slot.setAttribute('data-viewable', 'false');
          slot.classList.remove('viewable');
        }
      }
    }, {
      threshold: [0, config.settings.viewabilityThreshold / 100, 1]
    });

    var slots = document.querySelectorAll('.ad-slot');
    for (var i = 0; i < slots.length; i++) {
      viewObserver.observe(slots[i]);
    }
  }

  // ─── Revenue Tracking ────────────────────────────────────

  function setupRevenueTracking() {
    if (!config.settings.revenueTrackingEnabled) return;
    revenueData = loadRevenueData();
  }

  function loadRevenueData() {
    try {
      var data = localStorage.getItem('skylax_revenue_data');
      if (data) return JSON.parse(data);
    } catch(e) {}
    return { impressions: {}, clicks: {}, viewable: {}, daily: {} };
  }

  function saveRevenueData() {
    try {
      localStorage.setItem('skylax_revenue_data', JSON.stringify(revenueData));
    } catch(e) {}
  }

  function trackImpression(slotId) {
    if (!config.settings.revenueTrackingEnabled) return;

    var today = new Date().toISOString().split('T')[0];
    if (!revenueData.impressions[slotId]) revenueData.impressions[slotId] = 0;
    revenueData.impressions[slotId]++;

    if (!revenueData.daily[today]) revenueData.daily[today] = { impressions: 0, clicks: 0 };
    revenueData.daily[today].impressions++;

    saveRevenueData();
    log('Impression tracked: ' + slotId);
  }

  function trackClick(slotId) {
    if (!config.settings.revenueTrackingEnabled) return;

    var today = new Date().toISOString().split('T')[0];
    if (!revenueData.clicks[slotId]) revenueData.clicks[slotId] = 0;
    revenueData.clicks[slotId]++;

    if (!revenueData.daily[today]) revenueData.daily[today] = { impressions: 0, clicks: 0 };
    revenueData.daily[today].clicks++;

    saveRevenueData();
    log('Click tracked: ' + slotId);
  }

  function trackViewability(slotId) {
    if (!config.settings.revenueTrackingEnabled) return;
    if (!revenueData.viewable[slotId]) revenueData.viewable[slotId] = 0;
    revenueData.viewable[slotId]++;
    saveRevenueData();
  }

  function getRevenueStats() {
    var stats = { totalImpressions: 0, totalClicks: 0, totalViewable: 0, ctr: 0, slots: {} };

    for (var slot in revenueData.impressions) {
      stats.totalImpressions += revenueData.impressions[slot];
      stats.totalClicks += (revenueData.clicks[slot] || 0);
      stats.totalViewable += (revenueData.viewable[slot] || 0);
      stats.slots[slot] = {
        impressions: revenueData.impressions[slot],
        clicks: revenueData.clicks[slot] || 0,
        viewable: revenueData.viewable[slot] || 0,
        ctr: revenueData.impressions[slot] > 0 ? ((revenueData.clicks[slot] || 0) / revenueData.impressions[slot] * 100).toFixed(2) : 0
      };
    }

    stats.ctr = stats.totalImpressions > 0 ? (stats.totalClicks / stats.totalImpressions * 100).toFixed(2) : 0;
    return stats;
  }

  // ─── A/B Testing ─────────────────────────────────────────

  function getVariant(slotId) {
    if (!config.settings.abTestEnabled) return 'A';

    var key = 'skylax_ab_' + slotId;
    var stored = localStorage.getItem(key);
    if (stored) return stored;

    var impressions = revenueData.impressions[slotId] || 0;
    if (impressions >= config.settings.abTestMinImpressions) {
      var stats = getRevenueStats();
      if (stats.slots[slotId]) {
        return stats.slots[slotId].ctr > 1 ? 'A' : 'B';
      }
    }

    var variant = Math.random() < 0.5 ? 'A' : 'B';
    localStorage.setItem(key, variant);
    return variant;
  }

  // ─── Ad Blocker Detection ────────────────────────────────

  function setupAdBlockerDetection() {
    // Multiple bait elements with common ad-blocker targets
    var baits = [
      { tag: 'div',  cls: 'ad-unit adsbox',          attr: 'data-ad-slot' },
      { tag: 'div',  cls: 'ad-banner ad placement',   attr: 'id' },
      { tag: 'ins',  cls: 'adsbygoogle',              attr: 'data-ad-client' },
      { tag: 'div',  cls: 'adsterra-native-bait',     attr: 'data-ad' }
    ];

    var baitEls = [];
    for (var i = 0; i < baits.length; i++) {
      var el = document.createElement(baits[i].tag);
      el.className = baits[i].cls;
      el.setAttribute(baits[i].attr, 'bait');
      el.innerHTML = '&nbsp;';
      el.style.cssText = 'position:absolute;left:-9999px;width:1px;height:1px;';
      document.body.appendChild(el);
      baitEls.push(el);
    }

    // Also check if Adsterra script actually loaded
    var adScriptLoaded = false;
    var scripts = document.querySelectorAll('script[src*="effectivecpmnetwork"]');
    if (scripts.length > 0) {
      adScriptLoaded = true;
    }

    setTimeout(function() {
      var blocked = false;
      for (var j = 0; j < baitEls.length; j++) {
        if (baitEls[j].offsetHeight === 0 || baitEls[j].clientHeight === 0 ||
            getComputedStyle(baitEls[j]).display === 'none') {
          blocked = true;
          break;
        }
      }

      // Clean up bait elements
      for (var k = 0; k < baitEls.length; k++) {
        baitEls[k].remove();
      }

      if (blocked || !adScriptLoaded) {
        log('Ad blocker detected');
        showAdBlockerFallback();
      }
    }, 300);
  }

  function showAdBlockerFallback() {
    // Target both .ad-slot (smart-ads) and .ad-container (theme inline ads)
    var selectors = '.ad-slot, .ad-container, .ad-after-title, .ad-after-content, .ad-sidebar, .ad-footer';
    var slots = document.querySelectorAll(selectors);
    for (var i = 0; i < slots.length; i++) {
      slots[i].innerHTML = '<div style="background:#f0f2f5;border:1px solid #e0e0e0;border-radius:8px;padding:20px;text-align:center;color:#666;font-size:13px;">' +
        '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#999" stroke-width="2" style="margin-bottom:8px"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="3" y1="9" x2="21" y2="9"/></svg>' +
        '<div style="font-weight:600;margin-bottom:4px;">Ad blocked</div>' +
        '<div style="font-size:12px;color:#999;">Disable your ad blocker to support Skylax Mag</div>' +
        '</div>';
      slots[i].style.display = 'block';
    }
  }

  // ─── Utilities ───────────────────────────────────────────

  function debounce(fn, delay) {
    var timer;
    return function() {
      var context = this;
      var args = arguments;
      clearTimeout(timer);
      timer = setTimeout(function() {
        fn.apply(context, args);
      }, delay);
    };
  }

  function log(msg) {
    if (window.console) console.log('[Skylax Ads] ' + msg);
  }

  // ─── Public API ──────────────────────────────────────────

  window.SkylaxAds = {
    init: init,
    getConfig: function() { return config; },
    setConfig: function(newConfig) { config = newConfig; saveConfig(); },
    getStats: getRevenueStats,
    getVariant: getVariant,
    reload: function() { adsLoaded = 0; init(); }
  };

  // ─── Auto-Init ──────────────────────────────────────────
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();

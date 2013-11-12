/* globals Components: true, Promise: true, gBrowser: true, Test: true,
           info: true, is: true, window: true*/

"use strict";

const { interfaces: Ci, classes: Cc, utils: Cu } = Components;
const { addObserver, removeObserver } = Cc["@mozilla.org/observer-service;1"].
                                          getService(Ci.nsIObserverService);
const { openWindow } = Cc["@mozilla.org/embedcomp/window-watcher;1"].
                         getService(Ci.nsIWindowWatcher);


const receive = topic => {
  const { promise, resolve, reject } = Promise.defer();
  const observer = {
    observe: (subject) => {
      removeObserver(observer, topic);
      clearTimeout(id, reject);
      resolve(subject);
    }
  };
  const id = setTimeout(reject, 9000, Error("Timeout"));
  addObserver(observer, topic, false);

  return promise;
};

const addTab = (...args) => gBrowser.addTab(...args);
const removeTab = tab => (gBrowser.removeTab(tab), tab);
const selectTab = tab => gBrowser.selectedTab = tab;
const hideTab = tab => gBrowser.hideTab(tab);
const showTab = tab => gBrowser.showTab(tab);
const moveTabTo = (tab, index) => gBrowser.moveTabTo(tab, index);
const pin = tab => gBrowser.pinTab(tab);
const unpin = tab => gBrowser.unpinTab(tab);
const addWindow = () =>
  openWindow(null, window.location.href, null, null, null);

const load = (tab, uri) => tab.linkedBrowser.loadURI(uri);

const test = Test(function*() {
  info("tab-open / tab-close");

  let opened = receive("tab-open");
  is(addTab(), (yield opened),
     "got tab-open notification");

  let closed = receive("tab-close");
  is(removeTab(gBrowser.selectedTab), (yield closed),
     "got tab-close notification");

  info("tab-select / tab-unselect");

  let selected = receive("tab-select");
  let unselected = receive("tab-unselect");
  let tab = gBrowser.selectedTab;
  opened = addTab();
  selectTab(opened);

  is(tab, (yield unselected),
     "existing tab was deselected");
  is(opened, (yield selected),
     "opened tab was selected");

  unselected = receive("tab-unselect");
  selected = receive("tab-select");
  removeTab(opened);

  is(opened, (yield unselected),
     "opened tab was closed & deselected");
  is(tab, (yield selected),
     "existing tab got selected");

  info("tab-move");

  let [tab0, tab1] = [gBrowser.selectedTab, addTab()];

  let moved = receive("tab-move");
  moveTabTo(tab0, 1);

  is(tab0, (yield moved),
     "first tab moved");

  moved = receive("tab-move");
  moveTabTo(tab1, 1);

  is(tab1, (yield moved),
     "second tab moved back");


  info("tab pin / unpin");

  let pinned = receive("tab-pinned");
  pin(tab1);

  is(tab1, (yield pinned),
     "pin notification received");

  let unpinned = receive("tab-unpinned");
  unpin(tab1);
  is(tab1, (yield unpinned),
     "unpin notification received");


  info("tab show / hide");

  selectTab(tab0);

  let hidden = receive("tab-hide");
  hideTab(tab1);
  is(tab1, (yield hidden), "hide notification received");

  let shown = receive("tab-show");
  showTab(tab1);
  is(tab1, (yield shown), "show notification received");

  removeTab(tab1);

  let busy = receive("tab-busy");
  let unbusy = receive("tab-unbusy");
  let renamed = receive("tab-title-change");
  tab = addTab();
  selectTab(tab);
  load(tab, "data:text/html;utf-8,<h1>1</h1>");

  is((yield busy), tab,
     "received busy notification for tab");
  is((yield unbusy), tab,
     "received unbusy notification for tab");
  is((yield renamed), tab,
     "received title-change notification for tab");

  let reiconed = receive("tab-icon-change");
  load(tab, "about:robots");
  is((yield reiconed), tab,
     "received icon-change notification for tab");

  removeTab(tab);

  info("tab initial window");

  let initial = receive("initial-tab-open");
  let newWindow = addWindow();

  is((yield initial), newWindow.gBrowser.selectedTab,
     "receive initial-tab-open on new window");

  opened = receive("tab-open");
  tab = newWindow.gBrowser.addTab();

  is((yield opened), tab,
     "tab-opened received from all windows");

  newWindow.close();
});

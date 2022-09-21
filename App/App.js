import {
  ARROW_DOWN,
  ARROW_LEFT,
  ARROW_RIGHT, ARROW_UP,
  ENTER_KEY,
  groupColors,
} from './consts.js';

const App = (function() {
  let currentWindowId = null;
  let listOfTabs = [];
  let highlightedTab = -1;
  let showOnlyCurrentWindow = true; // = true;
  let eventCounter = 0;

  /**
   * main entry point
   * */
  async function init({ settings }) {
    const { onlyCurrentWindow = true, theme = {} } = settings;
    const { name = 'dark' } = theme;

    const tabGroup = await getTabsGroups();   

    if (tabGroup) {
      setGroupsIcons(tabGroup);
    }

    registerEvents();
    listOfTabs = await getCurrentTab();

    displayList({ tabsList: listOfTabs, tabGroup: [] });

    addToGroup({listOfTabs});
  }

  function addToGroup({listOfTabs}){
    listOfTabs.forEach(async tab => {
          const groups = getGroupData({ tabGroup, groupId: tab.groupId });
    
          let groupParams = null;
    
          if (groups) {
            const { collapsed, color, title } = params;
            groupParams = { collapsed, color, title };
          }
    
          const tabRow = await buildTabRow({ tab, currentWindowId, onlyTabInWindow: tabs.length === 1, groupParams });
  
          tabRowFragment.appendChild(tabRow);
        });
  }

  //TG
  function setGroupsIcons(groups) {
    groups.forEach(group => {
      const div = document.createElement('div');
      div.className = 'tab-group';
      div.style.background = groupColors[group.color];
      div.textContent = group.title;
      div.dataset.collapsed = group.collapsed; 
      div.dataset.id = group.id;
      div.dataset.type = 'group';

      document.querySelector('#groups').appendChild(div);
    });
  }

  //TG
  function getTabsGroups() {
    if (chrome.tabGroups) {
      return new Promise(resolve => {
        chrome.tabGroups.query({}, function(tabGroup){
          resolve(tabGroup);
        });
      });
    } else {
      return Promise.resolve(null);
    }
  }

  /**
   * Get current tab using chrome's own getAll method
   * */
  function getCurrentTab() {
    return new Promise(resolve => {
        chrome.windows.getCurrent({ populate: true }, window => {
          let queryOptions = { active: true, lastFocusedWindow: true };
          chrome.tabs.query(queryOptions, tabs => {
            resolve(tabs);
          })
        }); 
    });
  }

  /**
   * register to user events such as click, mousedown and handlign filter box and filter
   * box clearance
   *  */
  //TG
  function registerEvents() {
    const tabList = document.querySelector('.tab-list');
    const filterBox = document.querySelector('.filterBox');
    const groups = document.querySelector('#groups');

    tabList.addEventListener('click', onTabListClick);
    tabList.addEventListener('mousedown', onMouseDown);
    filterBox.addEventListener('keyup', filterTabs);

    groups.addEventListener('click', onTabGroupClick);

    document
      .querySelector('.remove-filter')
      .addEventListener('click', clearFilter);
    document
      .querySelector('body')
      .addEventListener('keyup', onKeyboardButtonPress);
    document
      .querySelector('body')
      .addEventListener('mousemove', onMouseMove);
  }
  //TG
  function onTabGroupClick(event) {
    const { target } = event;
    if (target.dataset.type === 'group') {
      let { id: groupId } = target.dataset;

      groupId = parseInt(groupId);

      chrome.tabGroups.get(groupId, tabGroup => {
        const { collapsed } = tabGroup;

        chrome.tabGroups.update(groupId, {
          collapsed: !collapsed
        }, function(tabGroup){
          // console.log('tabGroup', tabGroup)
        })
      });
    }
  }

  /**
   * onmouse move handle for the body
   */
  function onMouseMove() {
    setHightlitedTab({ set: false });
  }

  /**
   * render the tab list object
   * @param {array} tabList - array of open tabs
   */
  async function displayList({ tabsList, tabGroup }) {
    const tabListDomElement = document.querySelector('.tab-list');
    const currentWindowId = await getCurrentWindow();

    if (showOnlyCurrentWindow) {
      const domFragment = await displayListOfTabsInCurrentWindowOnly({ tabs: tabsList, currentWindowId, tabGroup });

      tabListDomElement.appendChild(domFragment);
    } else {
      tabsList.sort((a, b) => {
        return (a.id === currentWindowId) ? -1 : 1;
      })

      tabsList.forEach(async (chromeWindow, index) => {
        const tabRowFragment = document.createDocumentFragment();
        const tabRowsList = await createAllTabRowsAsync({ tabList: chromeWindow.tabs, currentWindowId });

        tabRowsList.forEach(tabRow => tabRowFragment.appendChild(tabRow));
          tabListDomElement.appendChild(tabRowFragment);
      });
    }
  }

  async function createAllTabRowsAsync({ tabList, currentWindowId }) {
    return new Promise(async (resolve, reject) => {
      try {
        const tabsPromises = await tabList.map(async tab => {
          const tabRow = await buildTabRow({ tab, currentWindowId, onlyTabInWindow: tabList.length === 1 });
          return tabRow;
        });

        const tabs = await Promise.all(tabsPromises);

        resolve(tabs);
      } catch(error) {
        reject(error);
      }
    })
  }

  /**
   * list of tabs without a group - only tabs in current window
   * @param {array} tabs - all tabs in the window that invoked the extension
   * @param {number} currentWindowId - current window id
   */
  async function displayListOfTabsInCurrentWindowOnly({ tabs, currentWindowId, tabGroup }) {
    const tabRowFragment = document.createDocumentFragment();
    let groupParams = null;
      const tabList = await createAllTabRowsAsync({ tabList: tabs, currentWindowId });

      tabList.forEach(tab => tabRowFragment.appendChild(tab));
    return tabRowFragment;
  }

  function getGroupData({ tabGroup, groupId }) {
    const tabGroupItem = tabGroup.filter(group => group.id === groupId);

    if (tabGroupItem.length > 0) {
      const { collapsed, color, title } = tabGroupItem[0];
      return {
        collapsed,
        color,
        title 
      }
    } else {
      return null;
    }
  }

  /**
   * Gets the current active window
   */
  function getCurrentWindow() {
    return new Promise(resolve => {
      chrome.windows.getCurrent({}, currentWindow => {
        resolve(currentWindow.id);
      });
    });
  }

  /**
   * create a tab row as div in the UI
   * @param {object} tab - chrome's tab object
   * @param {number} currentWindowId - id of current window
   * @param {boolean} onlyTabInWindow - is there only one tab in the window, if yes than don't style it as active
   */
  async function buildTabRow({ tab, currentWindowId, onlyTabInWindow, groupParams }) {
    const active = tab.active && tab.windowId === currentWindowId && !onlyTabInWindow ? 'active' : '';

    const tabRow = document.createElement('div');
    tabRow.className = `tab-row ${active}`;
    tabRow.dataset.tabId = tab.id;
    tabRow.dataset.windowId = tab.windowId;

    // if (false && chrome.tabGroups) {
    //     const { groupId } = tab; 

    //     if (groupId > 0) {
    //       const { tabColor, id, collapsed, title } = await (() => {
    //         return new Promise(resolve => {
    //           chrome.tabGroups.get(groupId, tabGroupParams => {
    //             const { color } = tabGroupParams;
    //             const tabColor = groupColors[color];
    //             resolve(tabGroupParams)
    //           });
    //         })
    //       })();

    //       const activePlaceHolder = createTabGroupPlaceHolder({ tabColor, id });

    //       tabRow.appendChild(activePlaceHolder);
    //     }
    // }

    const tabTitle = createTabTitle({ tab });
    tabRow.appendChild(tabTitle);
    return tabRow;
  }

  /**
   * create a div containing the title of tab
   * @param {object} tab - chrome's tab object
   */
  function createTabTitle({ tab }) {
    const tabTitle = document.createElement('div');
    tabTitle.className = 'tab-title';

    const tabDesc = document.createElement('span');
    tabDesc.className = 'tab-desc';
    tabDesc.innerText = tab.title;

    tabTitle.appendChild(tabDesc);
    return tabTitle;
  }

  /**
   * Removes filter on box and calling the display list to render the list again
   */
  function clearFilter() {
    displayList({ tabsList: listOfTabs });
  }

  /**
   * handle middle click button, closes the tab
   * @param {event} event - mouse down event
   */
  function onMouseDown(event) {
    event.stopImmediatePropagation();

    const isMiddleButtonDown = event.button === 1;

    if (isMiddleButtonDown) {
      const { tabId } = getTabData(event);
      if (!tabId) {
        return;
      }

      removeTabFromList(tabId);
      closeTab(tabId);
    }
  }

  /**
   * handle clicking on a tab row
   * @param {event} event - onClick event
   */
  function onTabListClick(event) {
    const { tabId, windowId } = getTabData(event);
    const tagName = event.target.tagName.toLowerCase();
    const type = event.target.dataset.type;

    if (type === 'speaker') {
      toggleMute(tabId);
      return;
    }

    // if ((tagName === 'img' || tagName === 'div') && type === 'closeButton') {
    if (type === 'closeButton') {
      removeTabFromList(tabId);
      closeTab(tabId);
    } else {
      if (!tabId) {
        return;
      }
      setActiveTab({ tabId, windowId });
    }
  }
  /**
   * handle click on a tab name in the list
   * @param {number} tabId - from chrome's tab data object. used to get the clicked tab
   * @param {number} windowId - index of the window
   */
  function setActiveTab({ tabId, windowId }) {
    chrome.windows.update(windowId, { focused: true }, function() {
      // selectedWindowId = windowId;
    });

    chrome.tabs.update(tabId, { active: true });
  }
  /**
   * handle on click on a tab to return it's id and window id (index of id)
   * @param {event} event - on click event
   */
  function getTabData(event) {
    let currentElement = event.target;
    let elementType = currentElement.tagName.toLowerCase();

    if (currentElement.classList.contains('tab-list')) {
      return {};
    }

    while (
      elementType !== 'div' ||
      (elementType === 'div' && !currentElement.classList.contains('tab-row'))
    ) {
      currentElement = currentElement.parentNode;
      elementType = currentElement.tagName.toLowerCase();
    }

    return {
      tabId: parseInt(currentElement.dataset.tabId),
      windowId: parseInt(currentElement.dataset.windowId)
    };
  }

  /**
   * handle closing the tab
   * @param {number} tabId - the tab the user clicked on closing
   */
  function closeTab(tabId) {
    chrome.tabs.remove(tabId, () => {
      if (!Array.isArray(listOfTabs)) {
        listOfTabs = [listOfTabs];
      }
  
      if (showOnlyCurrentWindow) {
          const index = listOfTabs.findIndex(tab => tab.id === tabId);
          if (index !== -1) {
            listOfTabs.splice(index, 1)
          }
      } else {
        listOfTabs.some(chromeWindow => {
          const index = chromeWindow.tabs.findIndex(tab => tab.id === tabId);
          if (index !== -1) {
            chromeWindow.tabs.splice(index, 1)
            return;
          }
        })
      }

      tabsCount = calcTabsCount({ groupOfTabs: listOfTabs });
    });

  }
  /**
   * Filter the tab list when writing in the filter box
   * @param {event} event - keyboard event
   */
  function filterTabs(event) {
    const { keyCode } = event;

    if (
      keyCode === ARROW_DOWN ||
      keyCode === ARROW_UP ||
      keyCode === ENTER_KEY ||
      keyCode === ARROW_LEFT ||
      keyCode === ARROW_RIGHT
    ) {
      return;
    }

    // clicking on the touchpad "middle click" fires 4 keyboard events
    // so, I use this hack to prevent the filter which caused the list to duplicate itself 4 times
    if (event.key === 'F22' || event.key === 'Shift' || event.key === 'Control' || event.key === 'Meta') {
      eventCounter++;
      return;
    }

    if (eventCounter === 3) {
      eventCounter = 0;
    }

    const valueToFilterBy = event.target.value.toLowerCase();
    if (valueToFilterBy.length === 0) {
      clearFilter();
      return;
    }

    let filteredList;

    if (showOnlyCurrentWindow) {
      filteredList = listOfTabs.filter(tab => {
        return (
          tab.title.toLowerCase().indexOf(valueToFilterBy) > -1 ||
          tab.url.toLowerCase().indexOf(valueToFilterBy) > -1
        );
      });    
    } else {
      filteredList = listOfTabs.map(group => {
        const tabs = group.tabs.filter(tab => {
          return (
            tab.title.toLowerCase().indexOf(valueToFilterBy) > -1 ||
            tab.url.toLowerCase().indexOf(valueToFilterBy) > -1
          );
        });
  
        return Object.assign({}, group, {
          tabs
        });
      });
    }

    displayFilteredList(filteredList);
    highlightedTab = -1;
    isInFilterMode = true;
    filteredResultsLength = calcTabsCount({
      groupOfTabs: filteredList
    });
  }

  function onKeyboardButtonPress(event) {
    const { keyCode } = event;

    // check if up/down arrows and enter
    if (
      keyCode === ARROW_DOWN ||
      keyCode === ARROW_UP ||
      keyCode === ENTER_KEY
    ) {
      switch (keyCode) {
        case ENTER_KEY: {
          const { tabId, windowId } = document.querySelectorAll('.tab-row')[
            highlightedTab
          ].dataset;
          const params = {
            tabId: parseInt(tabId),
            windowId: parseInt(windowId)
          };

          setActiveTab(params);
          break;
        }

        case ARROW_UP: {
          highlightPreviousTab();
          break;
        }
        case ARROW_DOWN: {
          highlightNextTab();
          break;
        }
      }
    }
  }

  /**
   * calculate how many open tabs are there including all open windows
   */
  function calcTabsCount({ groupOfTabs }) {
    if (showOnlyCurrentWindow) {
      return groupOfTabs.length;
    }

    if(!Array.isArray(groupOfTabs)) {
      groupOfTabs = [groupOfTabs]
    }
    
    if (groupOfTabs.length === 1) {
      return groupOfTabs[0].tabs.length;
    }

    let total = 0;
    const totalTabsNumber = groupOfTabs.reduce((tabCount, currentValue) => {
      return tabCount + currentValue.tabs.length;
    }, total);

    return totalTabsNumber;
  }


  /**
   * Display the results of the filter as a list
   * @param {array} filteredListOfTabs - list of filter tabs
   */

  function displayFilteredList(filteredListOfTabs) {
    const tabListDomElement = document.querySelector('.tab-list');
    tabListDomElement.textContent = '';
    displayList({ tabsList: filteredListOfTabs });
  }

  return {
    init
  }
})();

export default App;

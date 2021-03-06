﻿import React from "./react";
import EventListener from "./EventListener";
import invariant from "@/lib/invariant";
import warning from "@/lib/warning";

(() => {
  // 最开始未载入 React 会报出错误.
  !React
    ? invariant(
        "ReactDOM was loaded before React. Make sure you load the React package before loading ReactDOM."
      )
    : void 0;

  const IndeterminateComponent = 0;
  const HostRoot = 1; // Root of a host tree. Could be nested inside another node.
  const FunctionalComponent = 2;
  const ClassComponent = 3;
  const HostComponent = 4;
  const HostText = 5;
  const Fragment = 6;

  const NoWork = 0;
  const Sync = 1;
  const Never = 2147483647; // Max int32: Math.pow(2, 31) - 1

  const NoEffect = 0;
  const PerformedWork = 1;

  const Placement = 1;
  const Update = 2;
  const PlacementAndUpdate = 3;
  const Deletion = 4;
  const ContentReset = 5;
  const Callback = 6;
  const Err = 7;
  const Ref = 8;

  const randomKey = Math.random()
    .toString(36)
    .slice(2);
  const internalInstanceKey = "__reactInternalInstance$" + randomKey;
  const internalEventHandlersKey = "__reactEventHandlers$" + randomKey;

  const alreadyListeningTo = {};
  const topListenersIDKey = "_reactListenersID" + ("" + Math.random()).slice(2);
  let reactTopListenerCounter = 0;

  const eventTypes = [
    "abort",
    "animationEnd",
    "animationIteration",
    "animationStart",
    "blur",
    "cancel",
    "canPlay",
    "canPlayThrough",
    "click",
    "close",
    "contextMenu",
    "copy",
    "cut",
    "doubleClick",
    "drag",
    "dragEnd",
    "dragEnter",
    "dragExit",
    "dragLeave",
    "dragOver",
    "dragStart",
    "drop",
    "durationChange",
    "emptied",
    "encrypted",
    "ended",
    "error",
    "focus",
    "input",
    "invalid",
    "keyDown",
    "keyPress",
    "keyUp",
    "load",
    "loadedData",
    "loadedMetadata",
    "loadStart",
    "mouseDown",
    "mouseMove",
    "mouseOut",
    "mouseOver",
    "mouseUp",
    "paste",
    "pause",
    "play",
    "playing",
    "progress",
    "rateChange",
    "reset",
    "scroll",
    "seeked",
    "seeking",
    "stalled",
    "submit",
    "suspend",
    "timeUpdate",
    "toggle",
    "touchCancel",
    "touchEnd",
    "touchMove",
    "touchStart",
    "transitionEnd",
    "volumeChange",
    "waiting",
    "wheel"
  ].map(event => {
    return "on" + event[0].toUpperCase() + event.slice(1);
  });

  function getEventBaseName(eventName) {
    if (eventTypes.includes(eventName)) {
      const eventBaseName = eventName[2].toLowerCase() + eventName.slice(3);
      return eventBaseName;
    }
    return null;
  }

  function get(key) {
    return key._reactInternalFiber;
  }

  function has(key) {
    return key._reactInternalFiber !== undefined;
  }

  function set(key, value) {
    key._reactInternalFiber = value;
  }

  function getEventTarget(nativeEvent) {
    const target = nativeEvent.target || nativeEvent.srcElement || window;
    return target.nodeType === TEXT_NODE ? target.parentNode : target;
  }

  function getEventHandler(handlerName, eventTarget) {
    if (!eventTarget) {
      return null;
    }
    if (eventTarget.memorizedProps.hasOwnProperty(handlerName)) {
      return eventTarget.memorizedProps[handlerName];
    }
    return null;
  }

  function dispatchEvent(handlerName, nativeEvent) {
    const nativeEventTarget = getEventTarget(nativeEvent);
    const eventHandler = getEventHandler(
      handlerName,
      nativeEventTarget[internalInstanceKey]
    );
    if (typeof eventHandler === "function") {
      eventHandler();
    }
  }

  function trapBubbledEvent(handlerName, handlerBaseName, element) {
    if (!element) {
      return null;
    }
    return EventListener.listen(
      element,
      handlerBaseName,
      dispatchEvent.bind(null, handlerName)
    );
  }

  function getListeningForDocument(mountAt) {
    if (!Object.prototype.hasOwnProperty.call(mountAt, topListenersIDKey)) {
      mountAt[topListenersIDKey] = reactTopListenerCounter++;
      alreadyListeningTo[mountAt[topListenersIDKey]] = {};
    }
    return alreadyListeningTo[mountAt[topListenersIDKey]];
  }

  function listenTo(regName, contentDocumentHandle) {
    const mountAt = contentDocumentHandle;
    const isListening = getListeningForDocument(mountAt);
    if (!(isListening.hasOwnProperty(regName) && isListening[regName])) {
      const eventBaseName = getEventBaseName(regName);
      if (!!eventBaseName) {
        trapBubbledEvent(regName, eventBaseName, mountAt);
      }
      isListening[regName] = true;
    }
  }

  // function getComponentName(fiber) {
  //   var type = fiber.type;

  //   if (typeof type === "string") {
  //     return type;
  //   }
  //   if (typeof type === "function") {
  //     return type.displayName || type.name;
  //   }
  //   return null;
  // }

  function trapClickOnNonInteractiveElement(node) {
    node.onclick = () => {};
  }

  function precacheFiberNode(hostInst, node) {
    node[internalInstanceKey] = hostInst;
  }

  function updateFiberProps(node, props) {
    node[internalEventHandlersKey] = props;
  }

  const UNIT_SIZE = 10; // 工作单元可用时间.
  // 幻数偏移.
  // 幻数: 不知道这个数字是干什么用的，究竟代表什么，但是编译后的程序可以正常运行，"魔术般的数字".
  const MAGIC_NUMBER_OFFSET = 2;

  // 1工作单元的可用时间为10ms.
  function msToExpirationTime(ms) {
    // 总是添加一个偏移量. 避免可用时间等于0.
    return ((ms / UNIT_SIZE) | 0) + MAGIC_NUMBER_OFFSET;
  }

  function ceiling(num, precision) {
    return (((num / precision) | 0) + 1) * precision;
  }

  function computeExpirationBucket(currentTime, expirationInMs, bucketSizeMs) {
    return ceiling(
      currentTime + expirationInMs / UNIT_SIZE,
      bucketSizeMs / UNIT_SIZE
    );
  }

  function FiberNode(tag, key, internalContextTag) {
    // Instance.
    this.tag = tag;
    this.key = key;
    this.type = null;
    this.stateNode = null;

    // Fiber.
    this["return"] = null;
    this.child = null;
    this.sibling = null;
    this.index = 0;

    this.ref = null;

    this.pendingProps = null;
    this.memorizedProps = null;
    this.updateQueue = null;
    this.memorizedState = null;

    this.internalContextTag = internalContextTag;

    // Effects.
    this.effectTag = NoEffect;
    this.nextEffect = null;
    this.firstEffect = null;
    this.lastEffect = null;

    this.expirationTime = NoWork;
    this.alternate = null;
  }

  const NoContext = 0;
  const AsyncUpdates = 1;

  let firstScheduledRoot = null;
  let lastScheduledRoot = null;

  let nextFlushedRoot = null;
  let nextFlushedExpirationTime = NoWork;

  let isBatchingUpdates = false;
  let isUnbatchingUpdates = false;

  const NESTED_UPDATE_LIMIT = 1000;
  let nestedUpdateCount = 0;

  // 节点类型
  const ELEMENT_NODE = 1; // 元素节点.
  const TEXT_NODE = 3; // 文本节点.
  const COMMENT_NODE = 8; // 注释节点.
  const DOCUMENT_NODE = 9; // (整个)文档(DOM树的)节点.
  const DOCUMENT_FRAGMENT_NODE = 11; // 文档片段节点.

  const RESERVED_PROPS = {
    children: true,
    defaultValue: true,
    defaultChecked: true,
    innerHTML: true,
    style: true
  };

  const properties = {};

  /**
   * 检测 DOM节点 是否是有效节点.
   * @param {object} node DOM节点.
   */
  function isValidContainer(node) {
    return !!(
      node &&
      (node.nodeType === ELEMENT_NODE ||
        node.nodeType === DOCUMENT_NODE ||
        node.nodeType === DOCUMENT_FRAGMENT_NODE ||
        (node.nodeType === COMMENT_NODE &&
          node.nodeValue === " react-mount-point-unstable "))
    );
  }

  function isReservedProp(name) {
    return RESERVED_PROPS.hasOwnProperty(name);
  }

  function shouldSetAttribute(name, value) {
    if (isReservedProp(name)) {
      return false;
    }
    if (
      name.length > 2 &&
      (name[0] === "o" || name[0] === "O") &&
      (name[1] === "n" || name[1] === "N")
    ) {
      return false;
    }
    if (value === null) {
      return true;
    }
    switch (typeof value) {
      case "boolean":
      case "undefined":
      case "number":
      case "string":
      case "object":
        return true;
      default:
        // function, symbol
        return false;
    }
  }

  function setValueForStyles(node, styles) {
    const { style } = node;
    for (let styleName in styles) {
      if (!styles.hasOwnProperty(styleName)) {
        continue;
      }
      style[styleName] = styles[styleName];
    }
  }

  function setTextContent(node, text) {
    if (text) {
      const { firstChild } = node;
      if (
        firstChild &&
        firstChild === node.lastChild &&
        firstChild.nodeType === TEXT_NODE
      ) {
        firstChild.nodeValue = text;
        return;
      }
    }
    node.textContent = text;
  }

  function setValueForProperty(node, name, value) {
    // if (shouldSetAttribute(name, value)) {
    // }
    node.setAttribute(name, value);
  }

  function setInitialDOMProperties(
    tag,
    domElement,
    rootContainerElement,
    nextProps
  ) {
    for (let propKey in nextProps) {
      if (!nextProps.hasOwnProperty(propKey)) {
        continue;
      }
      let nextProp = nextProps[propKey];
      if (propKey === "style") {
        setValueForStyles(domElement, nextProp);
      } else if (propKey === "children") {
        if (typeof nextProp === "string") {
          const canSetTextContent = tag !== "textarea" || nextProp !== "";
          if (canSetTextContent) {
            setTextContent(domElement, nextProp);
          }
        } else if (typeof nextProp === "number") {
          setTextContent(domElement, "" + nextProp);
        }
      } else if (eventTypes.includes(propKey)) {
        if (nextProp != null) {
          if (typeof nextProp !== "function") {
            warning(
              `Expected '${propKey}' listener to be a function, instaed of got ${
                nextProp === false
                  ? "'false'"
                  : "a value of '" + typeof nextProp + "' type."
              }`
            );
          }
          ensureListeningTo(rootContainerElement, propKey);
        }
      } else if (nextProp != null) {
        setValueForProperty(domElement, propKey, nextProp);
      }
    }
  }

  function ensureListeningTo(rootContainerElement, regName) {
    const doc =
      rootContainerElement.nodeType === DOCUMENT_NODE ||
      rootContainerElement.nodeType === DOCUMENT_FRAGMENT_NODE
        ? rootContainerElement
        : rootContainerElement.ownerDocument;
    listenTo(regName, doc);
  }

  const voidElementTags = {
    area: true,
    base: true,
    br: true,
    col: true,
    embed: true,
    hr: true,
    img: true,
    input: true,
    keygen: true,
    link: true,
    meta: true,
    param: true,
    source: true,
    track: true,
    wbr: true
  };

  function assertValidProps(tag, props) {
    if (!props) {
      return;
    }
    if (voidElementTags[tag]) {
      props.children != null
        ? invariant(
            `${tag} is a void element tag and must not have 'children'.`
          )
        : void 0;
    }
    !(props.style == null || typeof props.style === "object")
      ? invariant(
          `The 'style' prop expects a mapping from style properties to values, not a string. For example, style={{marginRight: spacing + 'em'}} when using JSX.`
        )
      : void 0;
  }

  let getRootHostContainer = null;

  const createFiber = (tag, key, internalContextTag) => {
    return new FiberNode(tag, key, internalContextTag);
  };

  function shouldConstruct(Component) {
    return !!(Component.prototype && Component.prototype.isReactComponent);
  }

  function createFiberRoot(containerInfo) {
    const uninitializedFiber = createHostRootFiber();
    const root = {
      current: uninitializedFiber,
      containerInfo,
      pendingChildren: null,
      remainingExpirationTime: NoWork,
      finishedWork: null,
      nextScheduledRoot: null
    };
    uninitializedFiber.stateNode = root;
    return root;
  }

  function createHostRootFiber() {
    const fiber = createFiber(HostRoot, null, NoContext);
    return fiber;
  }

  function createFiberFromElement(element, internalContextTag, expirationTime) {
    let fiber = void 0;
    const { type, key } = element;
    if (typeof type === "function") {
      fiber = shouldConstruct(type)
        ? createFiber(ClassComponent, key, internalContextTag)
        : createFiber(IndeterminateComponent, key, internalContextTag);
      fiber.type = type;
      fiber.pendingProps = element.props;
    } else if (typeof type === "string") {
      fiber = createFiber(HostComponent, key, internalContextTag);
      fiber.type = type;
      fiber.pendingProps = element.props;
    } else if (
      typeof type === "object" &&
      type !== null &&
      typeof type.tag === "number"
    ) {
      fiber = type;
      fiber.pendingProps = element.props;
    } else {
      invariant(
        `Element type is invalid: expected a string (for built-in components) or a class/function (for composite components) but got: ${
          type == null ? type : typeof type
        }`
      );
    }

    fiber.expirationTime = expirationTime;

    return fiber;
  }

  function createFiberFromText(content, internalContextTag, expirationTime) {
    const fiber = createFiber(HostText, null, internalContextTag);
    fiber.pendingProps = content;
    fiber.expirationTime = expirationTime;
    return fiber;
  }

  function createFiberFromFragment(
    elements,
    internalContextTag,
    expirationTime,
    key
  ) {
    const fiber = createFiber(Fragment, key, internalContextTag);
    fiber.pendingProps = elements;
    fiber.expirationTime = expirationTime;
    return fiber;
  }

  function createWorkInProgress(current, pendingProps, expirationTime) {
    let workInProgress = current.alternate;
    if (workInProgress === null) {
      workInProgress = createFiber(
        current.tag,
        current.key,
        current.internalContextTag
      );
      workInProgress.type = current.type;
      workInProgress.stateNode = current.stateNode;

      workInProgress.alternate = current;
      current.alternate = workInProgress;
    } else {
      workInProgress.effectTag = NoEffect;
      workInProgress.nextEffect = null;
      workInProgress.firstEffect = null;
      workInProgress.lastEffect = null;
    }

    workInProgress.expirationTime = expirationTime;
    workInProgress.pendingProps = pendingProps;

    workInProgress.child = current.child;
    workInProgress.memorizedProps = current.memorizedProps;
    workInProgress.memorizedState = current.memorizedState;
    workInProgress.updateQueue = current.updateQueue;

    workInProgress.sibling = current.sibling;
    workInProgress.index = current.index;
    workInProgress.ref = current.ref;

    return workInProgress;
  }

  function createUpdateQueue(baseState) {
    const queue = {
      baseState,
      expirationTime: NoWork,
      first: null,
      last: null,
      callbackList: null,
      hasForceUpdate: false,
      isInitialized: false
    };
    return queue;
  }

  function processUpdateQueue(
    current,
    workInProgress,
    queue,
    instance,
    props,
    renderExpirationTime
  ) {
    if (current !== null && current.updateQueue === queue) {
      const { baseState, expirationTime, first, last, isInitialized } = queue;
      queue = workInProgress.updateQueue = {
        baseState,
        expirationTime,
        first,
        last,
        callbackList: null,
        hasForceUpdate: false,
        isInitialized
      };
    }
    queue.expirationTime = NoWork;
    let state = void 0;
    if (queue.isInitialized) {
      state = queue.baseState;
    } else {
      state = queue.baseState = workInProgress.memorizedState;
      queue.isInitialized = true;
    }
    let dontMutatePrevState = true;
    let update = queue.first;
    let didSkip = false;
    while (update !== null) {
      const updateExpirationTime = update.expirationTime;
      if (updateExpirationTime > renderExpirationTime) {
        const remainingExpirationTime = queue.expirationTime;
        if (
          remainingExpirationTime === NoWork ||
          remainingExpirationTime > updateExpirationTime
        ) {
          queue.expirationTime = updateExpirationTime;
        }
        if (!didSkip) {
          didSkip = true;
          queue.baseState = state;
        }
        update = update.next;
        continue;
      }

      if (!didSkip) {
        queue.first = update.next;
        if (queue.first === null) {
          queue.last = null;
        }
      }

      let partialState = void 0;
      if (update.isReplace) {
        state = getStateFromUpdate(update, instance, state, props);
        dontMutatePrevState = true;
      } else {
        partialState = getStateFromUpdate(update, instance, state, props);
        if (partialState) {
          if (dontMutatePrevState) {
            state = Object.assign({}, state, partialState);
          } else {
            state = Object.assign(state, partialState);
          }
          dontMutatePrevState = false;
        }
      }
      if (update.isForced) {
        queue.hasForceUpdate = true;
      }
      if (update.callback !== null) {
        let { callbackList } = queue;
        if (callbackList === null) {
          callbackList = queue.callbackList = [];
        }
        callbackList.push(update);
      }
      update = update.next;
    }

    if (queue.callbackList !== null) {
      workInProgress.effectTag = Callback;
    } else if (queue.first === null && !queue.hasForceUpdate) {
      workInProgress.updateQueue = null;
    }

    if (!didSkip) {
      didSkip = true;
      queue.baseState = state;
    }

    return state;
  }

  function getStateFromUpdate(update, instance, prevState, props) {
    const { partialState } = update;
    if (typeof partialState === "function") {
      let updateFn = partialState;
      return updateFn.call(instance, prevState, props);
    } else {
      return partialState;
    }
  }

  function insertUpdateIntoQueue(queue, update) {
    if (queue.last === null) {
      queue.first = queue.last = update;
    } else {
      queue.last.next = update;
      queue.last = update;
    }
    if (
      queue.expirationTime === NoWork ||
      queue.expirationTime > update.expirationTime
    ) {
      queue.expirationTime = update.expirationTime;
    }
  }

  function insertUpdateIntoFiber(fiber, update) {
    const alternateFiber = fiber.alternate;
    let queue1 = fiber.updateQueue;
    if (queue1 === null) {
      queue1 = fiber.updateQueue = createUpdateQueue(null);
    }
    let queue2 = void 0;
    if (alternateFiber !== null) {
      queue2 = alternateFiber.updateQueue;
      if (queue2 === null) {
        queue2 = alternateFiber.updateQueue = createUpdateQueue(null);
      }
    } else {
      queue2 = null;
    }
    queue2 = queue2 !== queue1 ? queue2 : null;

    if (queue2 === null) {
      insertUpdateIntoQueue(queue1, update);
      return;
    }

    if (queue1.last === null || queue2.last === null) {
      insertUpdateIntoQueue(queue1, update);
      insertUpdateIntoQueue(queue2, update);
      return;
    }

    insertUpdateIntoQueue(queue1, update);
    queue2.last = update;
  }

  function getUpdateExpirationTime(fiber) {
    if (fiber.tag !== ClassComponent && fiber.tag !== HostRoot) {
      return NoWork;
    }
    const { updateQueue } = fiber;
    if (updateQueue === null) {
      return NoWork;
    }
    return updateQueue.expirationTime;
  }

  let enableUserTimingAPI = true;

  function recordScheduleUpdate() {
    if (enableUserTimingAPI) {
      if (isCommitting) {
        hasScheduledUpdateInCurrentCommit = true;
      }
      if (
        currentPhase !== null &&
        currentPhase !== "componentWillMount" &&
        currentPhase !== "componentWillReceiveProps"
      ) {
        hasScheduledUpdateInCurrentPhase = true;
      }
    }
  }

  function renderSubtreeIntoContainer(
    parentComponent,
    children,
    container,
    callback
  ) {
    !isValidContainer(container)
      ? invariant("Target container is not a DOM element.")
      : void 0;

    let root = container._reactRootContainer;
    if (!root) {
      const newRoot = DOMRenderer.createContainer(container);
      root = container._reactRootContainer = newRoot;
      DOMRenderer.unbatchedUpdates(() => {
        DOMRenderer.updateContainer(children, newRoot, callback);
      });
    } else {
      DOMRenderer.updateContainer(children, root, callback);
    }
    return DOMRenderer.getPublicRootInstance(root);
  }

  let startTime = Date.now();
  let mostRecentCurrentTime = msToExpirationTime(0);
  let expirationContext = NoWork;

  let currentFiber = null;
  let currentPhase = null;
  let currentPhaseFiber = null;

  let isWorking = false;
  let isCommitting = false;
  let isUnmounting = false;
  let isRendering = false;

  let interruptedBy = null;

  let hasScheduledUpdateInCurrentCommit = false;
  let hasScheduledUpdateInCurrentPhase = false;

  let nextUnitOfWork = null;
  let nextRoot = null;
  let nextRenderExpirationTime = NoWork;
  let nextEffect = null;

  let useSyncScheduling = true;

  function recalculateCurrentTime() {
    const ms = Date.now() - startTime;
    mostRecentCurrentTime = msToExpirationTime(ms);
    return mostRecentCurrentTime;
  }

  function computeExpirationForFiber(fiber) {
    let expirationTime = void 0;
    if (expirationContext !== NoWork) {
      expirationTime = expirationContext;
    } else if (isWorking) {
      if (isCommitting) {
        expirationTime = Sync;
      } else {
        expirationTime = nextRenderExpirationTime;
      }
    } else {
      expirationTime = Sync;
    }
    return expirationTime;
  }

  function findHighestPriorityRoot() {
    let highestPriorityWork = NoWork;
    let highestPriorityRoot = null;

    if (lastScheduledRoot !== null) {
      let previousScheduledRoot = lastScheduledRoot;
      let root = firstScheduledRoot;
      while (root !== null) {
        let { remainingExpirationTime } = root;
        if (remainingExpirationTime === NoWork) {
          !(previousScheduledRoot !== null && lastScheduledRoot !== null)
            ? invariant(
                "Should have a previous and last root. This error is likely caused by a bug in React. Please file an issue."
              )
            : void 0;
          if (root === root.nextScheduledRoot) {
            root.nextScheduledRoot = null;
            firstScheduledRoot = lastScheduledRoot = null;
            break;
          } else if (root === firstScheduledRoot) {
            let next = root.nextScheduledRoot;
            firstScheduledRoot = next;
            lastScheduledRoot.nextScheduledRoot = next;
            root.nextScheduledRoot = null;
          } else if (root === lastScheduledRoot) {
            lastScheduledRoot = previousScheduledRoot;
            lastScheduledRoot.nextScheduledRoot = root.nextScheduledRoot;
            root.nextScheduledRoot = null;
            break;
          } else {
            previousScheduledRoot.nextScheduledRoot = root.nextScheduledRoot;
            root.nextScheduledRoot = null;
          }
          root = previousScheduledRoot.nextScheduledRoot;
        } else {
          if (
            highestPriorityWork === NoWork ||
            remainingExpirationTime < highestPriorityWork
          ) {
            highestPriorityWork = remainingExpirationTime;
            highestPriorityRoot = root;
          }
          if (root === lastScheduledRoot) {
            break;
          }
          previousScheduledRoot = root;
          root = root.nextScheduledRoot;
        }
      }
    }

    let previousFlushedRoot = nextFlushedRoot;
    if (
      previousFlushedRoot !== null &&
      previousFlushedRoot === highestPriorityRoot
    ) {
      nestedUpdateCount++;
    } else {
      nestedUpdateCount = 0;
    }
    nextFlushedRoot = highestPriorityRoot;
    nextFlushedExpirationTime = highestPriorityWork;
  }

  function scheduleTopLevelUpdate(current, element, callback) {
    callback = callback === void 0 ? null : callback;
    let expirationTime = computeExpirationForFiber(current);
    const update = {
      expirationTime,
      partialState: { element },
      callback,
      isReplace: false,
      isForced: false,
      nextCallback: null,
      next: null
    };
    insertUpdateIntoFiber(current, update);
    scheduleWork(current, expirationTime);
  }

  function scheduleWork(fiber, expirationTime) {
    recordScheduleUpdate();
    let node = fiber;
    while (node !== null) {
      if (
        node.expirationTime === NoWork ||
        node.expirationTime > expirationTime
      ) {
        node.expirationTime = expirationTime;
      }
      if (node.alternate !== null) {
        if (
          node.alternate.expirationTime === NoWork ||
          node.alternate.expirationTime > expirationTime
        ) {
          node.alternate.expirationTime = expirationTime;
        }
      }
      if (node["return"] === null) {
        if (node.tag === HostRoot) {
          let root = node.stateNode;
          checkRootNeedsClearing(root, fiber, expirationTime);
          requestWork(root, expirationTime);
          checkRootNeedsClearing(root, fiber, expirationTime);
        } else {
          return;
        }
      }
      node = node["return"];
    }
  }

  function checkRootNeedsClearing(root, fiber, expirationTime) {
    if (
      !isWorking &&
      root === nextRoot &&
      expirationTime < nextRenderExpirationTime
    ) {
      if (nextUnitOfWork !== null) {
        interruptedBy = fiber;
      }
      nextRoot = null;
      nextUnitOfWork = null;
      nextRenderExpirationTime = NoWork;
    }
  }

  function requestWork(root, expirationTime) {
    if (nestedUpdateCount > NESTED_UPDATE_LIMIT) {
      invariant(
        "Maximum update depth exceeded. This can happen when a component repeatedly calls setState inside componentWillUpdate or componentDidUpdate. React limits the number of nested updates to prevent infinite loops."
      );
    }

    if (root.nextScheduledRoot === null) {
      root.remainingExpirationTime = expirationTime;
      if (lastScheduledRoot === null) {
        firstScheduledRoot = lastScheduledRoot = root;
        root.nextScheduledRoot = root;
      } else {
        lastScheduledRoot.nextScheduledRoot = root;
        lastScheduledRoot = root;
        lastScheduledRoot.nextScheduledRoot = firstScheduledRoot;
      }
    } else {
      const { remainingExpirationTime } = root;
      if (
        remainingExpirationTime === NoWork ||
        expirationTime < remainingExpirationTime
      ) {
        root.remainingExpirationTime = expirationTime;
      }
    }

    if (isRendering) {
      return;
    }

    if (isBatchingUpdates) {
      if (isUnbatchingUpdates) {
        nextFlushedRoot = root;
        nextFlushedExpirationTime = Sync;
        performWorkOnRoot(nextFlushedRoot, nextFlushedExpirationTime);
      }
      return;
    }

    performWork(Sync);
  }

  function performWork(minExpirationTime) {
    findHighestPriorityRoot();

    while (
      nextFlushedRoot !== null &&
      nextFlushedExpirationTime !== NoWork &&
      (minExpirationTime === NoWork ||
        nextFlushedExpirationTime <= minExpirationTime)
    ) {
      performWorkOnRoot(nextFlushedRoot, nextFlushedExpirationTime);
      findHighestPriorityRoot();
    }
  }

  function performWorkOnRoot(root, expirationTime) {
    !!isRendering
      ? invariant(
          "performWorkOnRoot was called recursively. This error is likely caused by a bug in React. Please file an issue."
        )
      : void 0;

    isRendering = true;
    let { finishedWork } = root;
    if (expirationTime <= recalculateCurrentTime()) {
      root.finishedWork = null;
      if (finishedWork !== null) {
        root.remainingExpirationTime = commitRoot(finishedWork);
      } else {
        finishedWork = renderRoot(root, expirationTime);
        if (finishedWork !== null) {
          root.remainingExpirationTime = commitRoot(finishedWork);
        }
      }
    }

    isRendering = false;
  }

  function performUnitOfWork(workInProgress) {
    const current = workInProgress.alternate;
    let next = beginWork(current, workInProgress, nextRenderExpirationTime);
    if (next === null) {
      next = completeUnitOfWork(workInProgress);
    }
    return next;
  }

  function completeUnitOfWork(workInProgress) {
    while (true) {
      const current = workInProgress.alternate;
      let next = completeWork(
        current,
        workInProgress,
        nextRenderExpirationTime
      );
      const returnFiber = workInProgress["return"];
      const siblingFiber = workInProgress.sibling;

      resetExpirationTime(workInProgress, nextRenderExpirationTime);

      if (next !== null) {
        return next;
      }
      if (returnFiber !== null) {
        if (returnFiber.firstEffect === null) {
          returnFiber.firstEffect = workInProgress.firstEffect;
        }
        if (workInProgress.lastEffect !== null) {
          if (returnFiber.lastEffect !== null) {
            returnFiber.lastEffect.nextEffect = workInProgress.firstEffect;
          }
          returnFiber.lastEffect = workInProgress.lastEffect;
        }
        const { effectTag } = workInProgress;
        if (effectTag >= PerformedWork) {
          if (returnFiber.lastEffect !== null) {
            returnFiber.lastEffect.nextEffect = workInProgress;
          } else {
            returnFiber.firstEffect = workInProgress;
          }
          returnFiber.lastEffect = workInProgress;
        }
      }
      if (siblingFiber !== null) {
        return siblingFiber;
      } else if (returnFiber !== null) {
        workInProgress = returnFiber;
        continue;
      } else {
        return null;
      }
    }
    return null;
  }

  function completeWork(current, workInProgress, renderExpirationTime) {
    let newProps = workInProgress.pendingProps;
    if (newProps === null) {
      newProps = workInProgress.memorizedProps;
    } else if (
      workInProgress.expirationTime !== Never ||
      renderExpirationTime === Never
    ) {
      workInProgress.pendingProps = null;
    }
    switch (workInProgress.tag) {
      case HostComponent:
        const rootContainerInstance = getRootHostContainer();
        const { type } = workInProgress;
        if (current !== null && workInProgress.stateNode != null) {
          const oldProps = current.memorizedProps;
          const instance = workInProgress.stateNode;
          const updatePayload = DOMRenderer.prepareUpdate(
            instance,
            type,
            oldProps,
            newProps,
            rootContainerInstance
          );
          workInProgress.updateQueue = updatePayload;
          if (updatePayload) {
            markUpdate(workInProgress);
          }
          if (current.ref !== workInProgress.ref) {
            markRef(workInProgress);
          }
        } else {
          if (!newProps) {
            !(workInProgress.stateNode !== null)
              ? invariant(
                  "We must have new props for new mounts. This error is likely caused by a bug in React. Please file an issue."
                )
              : void 0;
            return null;
          }
          const instance = DOMRenderer.createInstance(
            type,
            newProps,
            workInProgress
          );
          appendAllChildren(instance, workInProgress);
          if (
            DOMRenderer.finalizeInitialChildren(
              instance,
              type,
              newProps,
              rootContainerInstance
            )
          ) {
            markUpdate(workInProgress);
          }
          workInProgress.stateNode = instance;

          if (workInProgress.ref !== null) {
            markRef(workInProgress);
          }
        }
        return null;
      case HostText:
        const newText = newProps;
        if (current && workInProgress.stateNode != null) {
          const oldText = current.memorizedProps;
          updateHostText$1(current, workInProgress, oldText, newText);
        } else {
          if (typeof newText !== "string") {
            !(workInProgress.stateNode !== null)
              ? invariant(
                  "We must have new props for new mounts. This error is likely caused by a bug in React. Please file an issue."
                )
              : void 0;
            return null;
          }
          workInProgress.stateNode = DOMRenderer.createTextInstance(
            newText,
            workInProgress
          );
        }
        return null;
      case HostRoot:
      case FunctionalComponent:
      case ClassComponent:
      case Fragment:
        return null;
      default:
        invariant(
          "Unknown unit of work tag. This error is likely caused by a bug in React. Please file an issue."
        );
    }
  }

  function resetExpirationTime(workInProgress, renderTime) {
    if (renderTime !== Never && workInProgress.expirationTime === Never) {
      return;
    }
    let newExpirationTime = getUpdateExpirationTime(workInProgress);
    let { child } = workInProgress;
    while (child !== null) {
      if (
        child.expirationTime !== NoWork &&
        (newExpirationTime === NoWork ||
          newExpirationTime > child.expirationTime)
      ) {
        newExpirationTime = child.expirationTime;
      }
      child = child.sibling;
    }
    workInProgress.expirationTime = newExpirationTime;
  }

  function workLoop(expirationTime) {
    if (
      nextRenderExpirationTime === NoWork ||
      nextRenderExpirationTime > expirationTime
    ) {
      return;
    }
    if (nextRenderExpirationTime <= mostRecentCurrentTime) {
      while (nextUnitOfWork !== null) {
        if (nextUnitOfWork.tag === ClassComponent) {
          // if (!!nextUnitOfWork.child) {
          //   console.log(
          //     nextUnitOfWork.child.memorizedProps.children[1].props.children[1]
          //   );
          // }
          // console.log(nextUnitOfWork)
        }
        nextUnitOfWork = performUnitOfWork(nextUnitOfWork);
      }
    }
  }

  function beginWork(current, workInProgress, renderExpirationTime) {
    switch (workInProgress.tag) {
      case HostRoot:
        return updateHostRoot(current, workInProgress, renderExpirationTime);
      case FunctionalComponent:
        return updateFunctionalComponent(current, workInProgress);
      case ClassComponent:
        return updateClassComponent(
          current,
          workInProgress,
          renderExpirationTime
        );
      case HostComponent:
        return updateHostComponent(
          current,
          workInProgress,
          renderExpirationTime
        );
      case HostText:
        return updateHostText(current, workInProgress);
      case Fragment:
        return updateFragment(current, workInProgress);
      default:
        invariant(
          "Unknown unit of work tag. This error is likely caused by a bug in React. Please file an issue."
        );
    }
  }

  function updateHostText$1(current, workInProgress, oldText, newText) {
    if (oldText !== newText) {
      markUpdate(workInProgress);
    }
  }

  const updater = {
    enqueueSetState(instance, partialState, callback) {
      const fiber = get(instance);
      callback = callback === void 0 ? null : callback;
      const expirationTime = computeExpirationForFiber(fiber);
      const update = {
        expirationTime,
        partialState,
        callback,
        isReplace: false,
        isForced: false,
        nextCallback: null,
        next: null
      };
      insertUpdateIntoFiber(fiber, update);
      scheduleWork(fiber, expirationTime);
    },
    enqueueReplaceState(instance, state, callback) {
      const fiber = get(instance);
      callback = callback === void 0 ? null : callback;
      const update = {
        expirationTime,
        partialState: state,
        callback,
        isReplace: true,
        isForced: false,
        nextCallback: null,
        next: null
      };
      insertUpdateIntoFiber(fiber, update);
      scheduleWork(fiber, expirationTime);
    }
  };

  function resetInputPointers(workInProgress, instance) {
    instance.props = workInProgress.memorizedProps;
    instance.state = workInProgress.memorizedState;
  }

  function adoptClassInstance(workInProgress, instance) {
    instance.updater = updater;
    workInProgress.stateNode = instance;
    set(instance, workInProgress);
  }

  function constructClassInstance(workInProgress, props) {
    const { type } = workInProgress;
    const instance = new type(props);
    adoptClassInstance(workInProgress, instance);
    return instance;
  }

  function callComponentWillMount(workInProgress, instance) {
    const oldState = instance.state;
    instance.componentWillMount();
    if (oldState !== instance.state) {
      updater.enqueueReplaceState(instance, instance.state, null);
    }
  }

  function callComponentWillReceiveProps(workInProgress, instance, newProps) {
    const oldState = instance.state;
    instance.componentWillReceiveProps(newProps);
    if (oldState !== instance.state) {
      updater, enqueueReplaceState(instance, instance.state, null);
    }
  }

  function mountClassInstance(workInProgress, renderExpirationTime) {
    const current = workInProgress.alternate;
    const instance = workInProgress.stateNode;
    const state = instance.state || null;
    const props = workInProgress.pendingProps;

    !props
      ? invariant(
          "There must be pending props for an initial mount. This error is likely caused by a bug in React. Please file an issue."
        )
      : void 0;

    instance.props = props;
    instance.state = workInProgress.memorizedState = state;
    instance.refs = {};

    if (typeof instance.componentWillMount === "function") {
      callComponentWillMount(workInProgress, instance);
      const { updateQueue } = workInProgress;
      if (updateQueue !== null) {
        instance.state = processUpdateQueue(
          current,
          workInProgress,
          updateQueue,
          instance,
          props,
          renderExpirationTime
        );
      }
    }
    if (typeof instance.componentDidMount === "function") {
      workInProgress.effectTag = Update;
    }
  }

  function checkShouldComponentUpdate(
    workInProgress,
    oldProps,
    newProps,
    oldState,
    newState
  ) {
    if (
      oldProps === null ||
      (workInProgress.updateQueue !== null &&
        workInProgress.updateQueue.hasForceUpdate)
    ) {
      return true;
    }
    const instance = workInProgress.stateNode;
    const { type } = workInProgress;
    if (typeof instance.shouldComponentUpdate === "function") {
      const shouldUpdate = instance.shouldComponentUpdate(newPorps, newState);
      return shouldUpdate;
    }
    return true;
  }

  function updateClassInstance(current, workInProgress, renderExpirationTime) {
    const instance = workInProgress.stateNode;
    resetInputPointers(workInProgress, instance);

    const oldProps = workInProgress.memorizedProps;
    let newProps = workInProgress.pendingProps;
    if (!newProps) {
      newProps = oldProps;
      !(newProps != null)
        ? invariant(
            "There should always be pending or memoized props. This error is likely caused by a bug in React. Please file an issue."
          )
        : void 0;
    }
    if (
      typeof instance.componentWillReceiveProps === "function" &&
      oldProps !== newProps
    ) {
      callComponentWillReceiveProps(workInProgress, instance, newProps);
    }

    const oldState = workInProgress.memorizedState;
    let newState = void 0;
    if (workInProgress.updateQueue !== null) {
      newState = processUpdateQueue(
        current,
        workInProgress,
        workInProgress.updateQueue,
        instance,
        newProps,
        renderExpirationTime
      );
    } else {
      newState = oldState;
    }

    if (
      oldProps === newProps &&
      oldState === newState &&
      !(
        workInProgress.updateQueue !== null &&
        workInProgress.updateQueue.hasForceUpdate
      )
    ) {
      if (typeof instance.componentDidUpdate === "function") {
        workInProgress.effectTag = Update;
      }
      return false;
    }

    const shouldUpdate = checkShouldComponentUpdate(
      workInProgress,
      oldProps,
      newProps,
      oldState,
      newState
    );
    if (shouldUpdate) {
      if (typeof instance.componentWillUpdate === "function") {
        instance.componentWillUpdate(newProps, newState);
      }
      if (typeof instance.componentDidUpdate === "function") {
        workInProgress.effectTag = Update;
      }
    } else {
      if (typeof instance.componentDidUpdate === "function") {
        if (
          oldProps !== current.memorizedProps ||
          oldState !== current.memorizedState
        ) {
          workInProgress.effectTag = Update;
        }
      }
      workInProgress.memorizedProps = newProps;
      workInProgress.memorizedState = newState;
    }

    instance.props = newProps;
    instance.state = newState;

    return shouldUpdate;
  }

  function updateHostRoot(current, workInProgress, renderExpirationTime) {
    const { updateQueue } = workInProgress;
    if (updateQueue !== null) {
      const prevState = workInProgress.memorizedState;
      const state = processUpdateQueue(
        current,
        workInProgress,
        updateQueue,
        null,
        null,
        renderExpirationTime
      );
      if (prevState === state) {
        return bailoutOnAlreadyFinishedWork(current, workInProgress);
      }
      const { element } = state;
      let root = workInProgress.stateNode;
      if (current === null || current.child === null) {
        workInProgress.effectTag = Placement;
        workInProgress.child = mountChildFibers(
          workInProgress,
          null,
          element,
          renderExpirationTime
        );
      } else {
        reconcileChildren(current, workInProgress, element);
      }
      return workInProgress.child;
    }
    return bailoutOnAlreadyFinishedWork(current, workInProgress);
  }

  function updateFunctionalComponent(current, workInProgress) {
    const fn = workInProgress.type;
    const { memorizedProps } = workInProgress;
    let nextProps = workInProgress.pendingProps;

    if (nextProps === null || memorizedProps === nextProps) {
      return bailoutOnAlreadyFinishedWork(current, workInProgress);
    }

    const nextChildren = fn(nextProps);
    workInProgress.effectTag = PerformedWork;
    reconcileChildren(current, workInProgress, nextChildren);
    workInProgress.memorizedProps = nextProps;
    return workInProgress.child;
  }

  function updateClassComponent(current, workInProgress, renderExpirationTime) {
    let shouldUpdate = void 0;
    if (current === null) {
      if (!workInProgress.stateNode) {
        constructClassInstance(workInProgress, workInProgress.pendingProps);
        mountClassInstance(workInProgress, renderExpirationTime);
        shouldUpdate = true;
      } else {
        invariant("Resuming work not yet implemented.");
      }
    } else {
      shouldUpdate = updateClassInstance(
        current,
        workInProgress,
        renderExpirationTime
      );
    }
    return finishClassComponent(current, workInProgress, shouldUpdate);
  }

  function finishClassComponent(current, workInProgress, shouldUpdate) {
    markRef(current, workInProgress);
    if (!shouldUpdate) {
      return bailoutOnAlreadyFinishedWork(current, workInProgress);
    }

    const instance = workInProgress.stateNode;
    const nextChildren = instance.render();
    workInProgress.effectTag = PerformedWork;
    reconcileChildren(current, workInProgress, nextChildren);
    workInProgress.memorizedState = instance.state;
    workInProgress.memorizedProps = instance.props;

    return workInProgress.child;
  }

  function updateHostComponent(current, workInProgress, renderExpirationTime) {
    const { type, memorizedProps } = workInProgress;
    let nextProps = workInProgress.pendingProps;
    if (nextProps === null) {
      nextProps = memorizedProps;
      !(nextProps !== null)
        ? invariant(
            "We should always have pending or current props. This error is likely caused by a bug in React. Please file an issue."
          )
        : void 0;
    }
    const prevProps = current !== null ? current.memorizedProps : null;
    if (nextProps === null || memorizedProps === nextProps) {
      return bailoutOnAlreadyFinishedWork(current, workInProgress);
    }
    let nextChildren = nextProps.children;
    const isDirectTextChild = DOMRenderer.shouldSetTextContent(type, nextProps);
    if (isDirectTextChild) {
      nextChildren = null;
    } else if (prevProps && DOMRenderer.shouldSetTextContent(type, prevProps)) {
      workInProgress.effectTag = ContentReset;
    }

    markRef(current, workInProgress);

    if (
      renderExpirationTime !== Never &&
      !useSyncScheduling &&
      !!nextProps.hidden
    ) {
      workInProgress.expirationTime = Never;
      return null;
    }
    reconcileChildren(current, workInProgress, nextChildren);
    workInProgress.memorizedProps = nextProps;
    return workInProgress.child;
  }

  function updateHostText(current, workInProgress) {
    let nextProps = workInProgress.pendingProps;
    if (nextProps === null) {
      nextProps = workInProgress.memorizedProps;
    }
    workInProgress.memorizedProps = nextProps;
    return null;
  }

  function updateFragment(current, workInProgress) {
    let nextChildren = workInProgress.pendingProps;
    if (
      nextChildren === null ||
      workInProgress.memorizedProps === nextChildren
    ) {
      return bailoutOnAlreadyFinishedWork(current, workInProgress);
    }
    reconcileChildren(current, workInProgress, nextChildren);
    workInProgress.memorizedProps = nextChildren;
    return workInProgress.child;
  }

  function markRef(current, workInProgress) {
    const { ref } = workInProgress;
    if (ref !== null && (!current || current.ref !== ref)) {
      workInProgress.effectTag = Ref;
    }
  }

  function markUpdate(workInProgress) {
    workInProgress.effectTag = Update;
  }

  function appendAllChildren(parent, workInProgress) {
    let node = workInProgress.child;
    while (node !== null) {
      if (node.tag === HostComponent || node.tag === HostText) {
        parent.appendChild(node.stateNode);
      } else if (node.tag !== null) {
        node.child["return"] = node;
        node = node.child;
        continue;
      }
      if (node === workInProgress) {
        return;
      }
      while (node.sibling === null) {
        if (node["return"] === null || node["return"] === workInProgress) {
          return;
        }
        node = node["return"];
      }
      node.sibling["return"] = node["return"];
      node = node.sibling;
    }
  }

  function ChildReconciler(shouldTrackSideEffects) {
    function createChild(returnFiber, newChild, expirationTime) {
      if (typeof newChild === "string" || typeof newChild === "number") {
        const created = createFiberFromText(
          "" + newChild,
          returnFiber.internalContextTag,
          expirationTime
        );
        created["return"] = returnFiber;
        return created;
      }

      if (
        typeof newChild === "object" &&
        newChild !== null &&
        newChild.type !== void 0
      ) {
        const created = createFiberFromElement(
          newChild,
          returnFiber.internalContextTag,
          expirationTime
        );
        created.ref = coerceRef(null, newChild);
        created["return"] = returnFiber;
        return created;
      }

      if (Array.isArray(newChild)) {
        const created = createFiberFromFragment(
          newChild,
          returnFiber.internalContextTag,
          expirationTime,
          newChild.key
        );
        created["return"] = returnFiber;
        return created;
      }

      return null;
    }

    function deleteChild(returnFiber, childToDelete) {
      if (!shouldTrackSideEffects) {
        return;
      }
      const last = returnFiber.lastEffect;
      if (last !== null) {
        last.nextEffect = childToDelete;
        returnFiber.lastEffect = childToDelete;
      } else {
        returnFiber.firstEffect = returnFiber.lastEffect = childToDelete;
      }
      childToDelete.nextEffect = null;
      childToDelete.effectTag = Deletion;
    }

    function deleteRemainingChildren(returnFiber, currentFirstChild) {
      if (!shouldTrackSideEffects) {
        return null;
      }

      let childToDelete = currentFirstChild;
      while (childToDelete !== null) {
        deleteChild(returnFiber, childToDelete);
        childToDelete = childToDelete.sibling;
      }
      return null;
    }

    function placeSingleChild(newFiber) {
      if (shouldTrackSideEffects && newFiber.alternate === null) {
        newFiber.effectTag = Placement;
      }
      return newFiber;
    }

    function placeChild(newFiber, lastPlacedIndex, newIndex) {
      newFiber.index = newIndex;
      if (!shouldTrackSideEffects) {
        return lastPlacedIndex;
      }
      const current = newFiber.alternate;
      if (current !== null) {
        const oldIndex = current.index;
        if (oldIndex < lastPlacedIndex) {
          newFiber.effectTag = Placement;
          return lastPlacedIndex;
        } else {
          return oldIndex;
        }
      } else {
        newFiber.effectTag = Placement;
        return lastPlacedIndex;
      }
    }

    function updateSlot(returnFiber, oldFiber, newChild, expirationTime) {
      const key = oldFiber !== null ? oldFiber.key : null;
      if (typeof newChild === "string" || typeof newChild === "number") {
        if (key !== null) {
          return null;
        }
        return updateTextNode(
          returnFiber,
          oldFiber,
          "" + newChild,
          expirationTime
        );
      }

      if (typeof newChild === "object" && newChild !== null) {
        if (newChild.type !== void 0) {
          if (newChild.key === key) {
            return updateElement(
              returnFiber,
              oldFiber,
              newChild,
              expirationTime
            );
          } else {
            return null;
          }
        }

        if (Array.isArray(newChild)) {
          if (key !== null) {
            return null;
          }
          return updateFragment$1(
            returnFiber,
            oldFiber,
            newChild,
            expirationTime,
            null
          );
        }
      }
      return null;
    }

    function mapRemainingChildren(returnFiber, currentFirstChild) {
      const existingChildren = new Map();
      let existingChild = currentFirstChild;
      while (existingChild !== null) {
        if (existingChild.key !== null) {
          existingChildren.set(existingChild.key, existingChild);
        } else {
          existingChildren.set(existingChild.index, existingChild);
        }
        existingChild = existingChild.sibling;
      }
      return existingChildren;
    }

    function updateFromMap(
      existingChildren,
      returnFiber,
      newIndex,
      newChild,
      expirationTime
    ) {
      if (typeof newChild === "string" || typeof newChild === "number") {
        const matchedFiber = existingChildren.get(newIndex) || null;
        return updateTextNode(
          returnFiber,
          matchedFiber,
          "" + newChild,
          expirationTime
        );
      }

      if (typeof newChild === "object" && newChild !== null) {
        if (newChild.type !== void 0) {
          const matchedFiber = existingChildren.get(
            newChild.key === null ? newIndex : newChild.key
          );
          return updateElement(
            returnFiber,
            matchedFiber,
            newChild,
            expirationTime
          );
        }

        if (Array.isArray(newChild)) {
          const matchedFiber = existingChildren.get(newIndex) || null;
          return updateFragment$1(
            returnFiber,
            matchedFiber,
            newChild,
            expirationTime,
            null
          );
        }
      }

      return null;
    }

    function updateElement(returnFiber, current, element, expirationTime) {
      let el = void 0;
      if (current !== null && current.type === element.type) {
        el = useFiber(current, element.props, expirationTime);
      } else {
        el = createFiberFromElement(
          element,
          returnFiber.internalContextTag,
          expirationTime
        );
      }
      el.ref = coerceRef(current, element);
      el["return"] = returnFiber;
      return el;
    }

    function updateTextNode(returnFiber, current, textContent, expirationTime) {
      let textNode = void 0;
      if (current === null || current.tag !== HostText) {
        textNode = createFiberFromText(
          textContent,
          returnFiber.internalContextTag,
          expirationTime
        );
      } else {
        textNode = useFiber(current, textContent, expirationTime);
      }
      textNode["return"] = returnFiber;
      return textNode;
    }

    function updateFragment$1(
      returnFiber,
      current,
      fragment,
      expirationTime,
      key
    ) {
      let fm = void 0;
      if (current === null || current.tag !== Fragment) {
        fm = createFiberFromFragment(
          fragment,
          returnFiber.internalContextTag,
          expirationTime,
          key
        );
      } else {
        fm = useFiber(current, fragment, expirationTime);
      }
      fm["return"] = returnFiber;
      return fm;
    }

    function useFiber(fiber, pendingProps, expirationTime) {
      const clone = createWorkInProgress(fiber, pendingProps, expirationTime);
      clone.index = 0;
      clone.sibling = null;
      return clone;
    }

    function coerceRef(current, element) {
      // to be continued;
      return null;
    }

    function reconcileSingleElement(
      returnFiber,
      currentFirstChild,
      element,
      expirationTime
    ) {
      const { key } = element;
      let child = currentFirstChild;
      while (child !== null) {
        if (child.key === key) {
          if (child.type === element.type) {
            deleteRemainingChildren(returnFiber, child.sibling);
            const existing = useFiber(child, element.props, expirationTime);
            existing.ref = coerceRef(child, element);
            existing["return"] = returnFiber;
            return existing;
          } else {
            deleteRemainingChildren(returnFiber, child);
            break;
          }
        } else {
          deleteChild(returnFiber, child);
        }
        child = child.sibling;
      }

      const created = createFiberFromElement(
        element,
        returnFiber.internalContextTag,
        expirationTime
      );
      created.ref = coerceRef(currentFirstChild, element);
      created["return"] = returnFiber;
      return created;
    }

    function reconcileSingleTextNode(
      returnFiber,
      currentFirstChild,
      textContent,
      expirationTime
    ) {
      if (currentFirstChild !== null && currentFirstChild.tag === HostText) {
        deleteRemainingChildren(returnFiber, currentFirstChild.sibling);
        const existing = useFiber(returnFiber, textContent, expirationTime);
        existing["return"] = returnFiber;
        return existing;
      }
      deleteRemainingChildren(returnFiber.currentFirstChild);
      const created = createFiberFromText(
        textContent,
        returnFiber.internalContextTag,
        expirationTime
      );
      created["return"] = returnFiber;
      return created;
    }

    function reconcileChildrenArray(
      returnFiber,
      currentFirstChild,
      newChildren,
      expirationTime
    ) {
      let resultingFirstChild = null;
      let previousNewFiber = null;

      let oldFiber = currentFirstChild;
      let lastPlacedIndex = 0;
      let newIndex = 0;
      let nextOldFiber = null;
      for (; oldFiber !== null && newIndex < newChildren.length; newIndex++) {
        if (oldFiber.index > newIndex) {
          newOldFiber = oldFiber;
          oldFiber = null;
        } else {
          nextOldFiber = oldFiber.sibling;
        }
        const newFiber = updateSlot(
          returnFiber,
          oldFiber,
          newChildren[newIndex],
          expirationTime
        );
        if (newFiber === null) {
          if (oldFiber === null) {
            oldFiber = nextOldFiber;
          }
          break;
        }
        if (shouldTrackSideEffects) {
          if (oldFiber && newFiber.alternate === null) {
            deleteChild(returnFiber, oldFiber);
          }
        }
        lastPlacedIndex = placeChild(newFiber, lastPlacedIndex, newIndex);
        if (previousNewFiber === null) {
          resultingFirstChild = newFiber;
        } else {
          previousNewFiber.sibling = newFiber;
        }
        previousNewFiber = newFiber;
        oldFiber = nextOldFiber;
      }

      if (newIndex === newChildren.length) {
        deleteRemainingChildren(returnFiber, oldFiber);
        return resultingFirstChild;
      }

      if (oldFiber === null) {
        for (; newIndex < newChildren.length; newIndex++) {
          const newFiber = createChild(
            returnFiber,
            newChildren[newIndex],
            expirationTime
          );
          if (!newFiber) {
            continue;
          }
          lastPlacedIndex = placeChild(newFiber, lastPlacedIndex, newIndex);
          if (previousNewFiber === null) {
            resultingFirstChild = newFiber;
          } else {
            previousNewFiber.sibling = newFiber;
          }
          previousNewFiber = newFiber;
        }
        return resultingFirstChild;
      }

      const existingChildren = mapRemainingChildren(returnFiber, oldFiber);
      for (; newIndex < newChildren.length; newIndex++) {
        const newFiber = updateFromMap(
          existingChildren,
          returnFiber,
          newIndex,
          newChildren[newIndex],
          expirationTime
        );
        if (newFiber) {
          if (shouldTrackSideEffects) {
            if (newFiber.alternate !== null) {
              existingChildren["delete"](
                newFiber.key === null ? newIndex : newFiber.key
              );
            }
          }
          lastPlacedIndex = placeChild(newFiber, lastPlacedIndex, newIndex);
          if (previousNewFiber === null) {
            resultingFirstChild = newFiber;
          } else {
            previousNewFiber.sibling = newFiber;
          }
          previousNewFiber = newFiber;
        }
      }

      if (shouldTrackSideEffects) {
        existingChildren.forEach(child => deleteChild(returnFiber, child));
      }

      return resultingFirstChild;
    }

    function reconcileChildFibers(
      returnFiber,
      currentFirstChild,
      newChild,
      expirationTime
    ) {
      if (
        typeof newChild === "object" &&
        newChild !== null &&
        newChild.type !== void 0
      ) {
        return placeSingleChild(
          reconcileSingleElement(
            returnFiber,
            currentFirstChild,
            newChild,
            expirationTime
          )
        );
      }

      if (typeof newChild === "string" || typeof newChild === "number") {
        return placeSingleChild(
          reconcileSingleTextNode(
            returnFiber,
            currentFiber,
            "" + newChild,
            expirationTime
          )
        );
      }

      if (Array.isArray(newChild)) {
        return reconcileChildrenArray(
          returnFiber,
          currentFirstChild,
          newChild,
          expirationTime
        );
      }

      return deleteRemainingChildren(returnFiber, currentFirstChild);
    }

    return reconcileChildFibers;
  }

  function reconcileChildren(current, workInProgress, nextChildren) {
    reconcileChildrenAtExpirationTime(
      current,
      workInProgress,
      nextChildren,
      workInProgress.expirationTime
    );
  }

  const reconcileChildFibers = ChildReconciler(true);
  const mountChildFibers = ChildReconciler(false);

  function cloneChildFibers(current, workInProgress) {
    !(current === null || workInProgress.child === current.child)
      ? invariant("Resuming work not yet implemented.")
      : void 0;
    if (workInProgress.child === null) {
      return;
    }

    let currentChild = workInProgress.child;
    let newChild = createWorkInProgress(
      currentChild,
      currentChild.pendingProps,
      currentChild.expirationTime
    );
    workInProgress.child = newChild;

    newChild["return"] = workInProgress;
    while (currentChild.sibling !== null) {
      currentChild = currentChild.sibling;
      newChild = newChild.sibling = createWorkInProgress(
        currentChild,
        currentChild.pendingProps,
        currentChild.expirationTime
      );
      newChild["return"] = workInProgress;
    }
    newChild.sibling = null;
  }

  function reconcileChildrenAtExpirationTime(
    current,
    workInProgress,
    nextChildren,
    renderExpirationTime
  ) {
    if (current === null) {
      workInProgress.child = mountChildFibers(
        workInProgress,
        null,
        nextChildren,
        renderExpirationTime
      );
    } else {
      workInProgress.child = reconcileChildFibers(
        workInProgress,
        current.child,
        nextChildren,
        renderExpirationTime
      );
    }
  }

  function bailoutOnAlreadyFinishedWork(current, workInProgress) {
    cloneChildFibers(current, workInProgress);
    return workInProgress.child;
  }

  function renderRoot(root, expirationTime) {
    !!isWorking
      ? invariant(
          "renderRoot was called recursively. This error is likely caused by a bug in React. Please file an issue."
        )
      : void 0;

    isWorking = true;
    if (
      root !== nextRoot ||
      expirationTime !== nextRenderExpirationTime ||
      nextUnitOfWork === null
    ) {
      nextRoot = root;
      nextRenderExpirationTime = expirationTime;
      nextUnitOfWork = createWorkInProgress(
        nextRoot.current,
        null,
        expirationTime
      );
    }
    workLoop(expirationTime);

    interruptedBy = null;
    isWorking = false;

    return root.current.alternate;
  }

  function commitRoot(finishedWork) {
    isWorking = true;
    isCommitting = true;

    let root = finishedWork.stateNode;
    !(root.current !== finishedWork)
      ? invariant(
          "Cannot commit the same tree as before. This is probably a bug related to the return field. This error is likely caused by a bug in React. Please file an issue."
        )
      : void 0;

    let firstEffect = void 0;
    if (finishedWork.effectTag > PerformedWork) {
      if (finishedWork.lastEffect !== null) {
        finishedWork.lastEffect.nextEffect = finishedWork;
        firstEffect = finishedWork.firstEffect;
      } else {
        firstEffect = finishedWork;
      }
    } else {
      firstEffect = finishedWork.firstEffect;
    }

    nextEffect = firstEffect;
    commitAllHostEffects();
    root.current = finishedWork;
    isCommitting = false;
    isWorking = false;

    const remainingTime = root.current.expirationTime;
    return remainingTime;
  }

  function commitPlacement(finishedWork) {
    const parentFiber = finishedWork["return"];
    let parent = void 0;
    switch (parentFiber.tag) {
      case HostRoot:
        parent = parentFiber.stateNode.containerInfo;
        break;
      case HostComponent:
        parent = parentFiber.stateNode;
        break;
      default:
        invariant(
          "Invalid host parent fiber. This error is likely caused by a bug in React. Please file an issue."
        );
    }
    const before = finishedWork.sibling;
    let node = finishedWork;
    while (true) {
      if (node.tag === HostComponent || node.tag === HostText) {
        if (before) {
          parent.insertBefore(node.stateNode, before);
        } else {
          parent.appendChild(node.stateNode);
        }
      } else if (node.child !== null) {
        node.child["return"] = node;
        node = node.child;
        continue;
      }
      if (node === finishedWork) {
        return;
      }
      while (node.sibling === null) {
        if (node["return"] === null || node["return"] === finishedWork) {
          return;
        }
        node = node["return"];
      }
      node.sibling["return"] = node["return"];
      node = node.sibling;
    }
  }

  function commitUpdate(
    domElement,
    updatePayload,
    type,
    oldProps,
    newProps,
    internalInstanceHandle
  ) {
    updateFiberProps(domElement, newProps);
    // updateProperties(domElement, updatePayload, type, oldProps, newProps);
  }

  function commitTextUpdate(textInstance, oldText, newText) {
    if (oldText !== newText) {
      textInstance.nodeValue = newText;
    }
  }

  function commitWork(current, finishedWork) {
    switch (finishedWork.tag) {
      case HostComponent:
        const instance = finishedWork.stateNode;
        if (instance != null) {
          const newProps = finishedWork.memorizedProps;
          const oldProps = current !== null ? current.memorizedProps : newProps;
          const { type } = finishedWork;
          const updatePayload = finishedWork.updateQueue;
          finishedWork.updateQueue = null;
          if (updatePayload !== null) {
            commitUpdate(
              instance,
              updatePayload,
              type,
              oldProps,
              newProps,
              finishedWork
            );
          }
        }
        return;
      case HostText:
        !(finishedWork.stateNode !== null)
          ? invariant(
              "This should have a text node initialized. This error is likely caused by a bug in React. Please file an issue."
            )
          : void 0;
        const textInstance = finishedWork.stateNode;
        const newText = finishedWork.memorizedProps;
        const oldText = current !== null ? current.memorizedProps : newText;
        commitTextUpdate(textInstance, oldText, newText);
        return;
      case HostRoot:
      case ClassComponent:
        return;
      default:
        invariant(
          "This unit of work tag should not have side-effects. This error is likely caused by a bug in React. Please file an issue."
        );
    }
  }

  function commitUnmount(current) {
    switch (current.tag) {
      case ClassComponent:
        // detachRef(current);
        const instance = current.stateNode;
        if (typeof instance.componentWillUnmount === "function") {
          instance.componentWillUnmount();
        }
        return;
      case HostComponent:
        // detachRef(current);
        return;
    }
  }

  function unmountHostComponents(current) {
    let node = current;
    let currentParentIsValid = false;
    let currentParent = void 0;

    while (true) {
      if (!currentParentIsValid) {
        let parent = node["return"];
        findParent: while (true) {
          !(parent !== null)
            ? invariant(
                "Expected to find a host parent. This error is likely caused by a bug in React. Please file an issue."
              )
            : void 0;
          switch (parent.tag) {
            case HostRoot:
              currentParent = parent.stateNode.containerInfo;
              break findParent;
            case HostComponent:
              currentParent = parent.stateNode;
              break findParent;
          }
          parent = parent["return"];
        }
        currentParentIsValid = true;
      }

      if (node.tag === HostComponent || node.tag === HostText) {
        currentParent.removeChild(node.stateNode);
      } else {
        commitUnmount(node);
        if (node.child !== null) {
          node.child["return"] = node;
          node = node.child;
          continue;
        }
      }
      if (node === current) {
        return;
      }
      while (node.sibling === null) {
        if (node["return"] === null || node["return"] === current) {
          return;
        }
        node = node["return"];
      }
      node.sibling["return"] = node["return"];
      node = node.sibling;
    }
  }

  function detachFiber(current) {
    current["return"] = null;
    current.child = null;
    if (current.alternate) {
      current.alternate["return"] = null;
      current.alternate.child = null;
    }
  }

  function commitDeletion(current) {
    unmountHostComponents(current);
    detachFiber(current);
  }

  function commitAllHostEffects() {
    while (nextEffect !== null) {
      const { effectTag } = nextEffect;
      switch (effectTag) {
        case Placement:
          commitPlacement(nextEffect);
          nextEffect.effectTag = NoEffect;
          break;
        case Update:
          commitWork(nextEffect.alternate, nextEffect);
          break;
        case PlacementAndUpdate:
          // Placement.
          commitPlacement(nextEffect);
          nextEffect.effectTag = NoEffect;
          // Update.
          commitWork(nextEffect.alternate, nextEffect);
          break;
        case Deletion:
          isUnmounting = true;
          commitDeletion(nextEffect);
          isUnmounting = false;
          break;
      }
      nextEffect = nextEffect.nextEffect;
    }
  }

  const DOMRenderer = (() => {
    // utils.

    function getPublicInstance(instance) {
      return instance;
    }
    function createElement(type) {
      let domElement;
      if (type === "script") {
        const div = document.createElement("div");
        div.innerHTML = "<script></script>";
        const { firstChild } = div;
        domElement = div.removeChild(firstChild);
      } else {
        domElement = document.createElement(type);
      }
      return domElement;
    }
    function createTextNode(text) {
      return document.createTextNode(text);
    }
    function setInitialProperties(
      domElement,
      tag,
      rawProps,
      rootContainerElement
    ) {
      let props;
      switch (tag) {
        case "input":
        case "option":
        case "select":
        case "textarea":
          props = getHostProps(tag, rawProps);
          break;
        default:
          props = rawProps;
      }
      assertValidProps(tag, props);
      setInitialDOMProperties(tag, domElement, rootContainerElement, props);
    }
    function shouldAutoFocusHostComponent(type, props) {
      switch (type) {
        case "button":
        case "input":
        case "select":
        case "textarea":
          return !!props.autoFocus;
        default:
          return false;
      }
    }
    function getHostProps(tag, props) {
      switch (tag) {
        case "input":
          const { value, checked } = props;
          return Object.assign(
            {
              type: undefined,
              step: undefined,
              min: undefined,
              max: undefined
            },
            props,
            {
              defaultChecked: undefined,
              defaultValue: undefined,
              value: value != null ? value : "",
              checked: checked != null ? checked : false
            }
          );
        case "option":
          const hostProps = Object.assign({ children: undefined }, props);
          const content = flattenChildren(props.children);
          if (content) {
            hostProps.children = content;
          }
          return hostProps;
        case "select":
          return Object.assign({}, props, {
            value: undefined
          });
        case "textarea":
          return Object.assign({}, props, {
            value: undefined,
            defaultValue: undefined,
            children: ""
          });
      }
    }
    function flattenChildren(children) {
      let content = "";
      React.children.forEach(children, child => {
        if (child == null) {
          return;
        }
        if (typeof child === "string" || typeof child === "number") {
          content += child;
        }
      });
      return content;
    }

    // module.export Functions.

    function getPublicRootInstance(container) {
      let { child } = container.current;
      if (!child) {
        return null;
      }
      switch (child.tag) {
        case HostComponent:
          return getPublicInstance(child.stateNode);
        default:
          return child.stateNode;
      }
    }
    function createInstance(type, props, internalInstanceHandle) {
      const domElement = createElement(type);
      precacheFiberNode(internalInstanceHandle, domElement);
      updateFiberProps(domElement, props);
      return domElement;
    }
    function createTextInstance(text, internalInstanceHandle) {
      const textNode = createTextNode(text);
      precacheFiberNode(internalInstanceHandle, textNode);
      return textNode;
    }
    function createContainer(containerInfo) {
      return createFiberRoot(containerInfo);
    }
    function updateContainer(element, container, callback) {
      scheduleTopLevelUpdate(container.current, element, callback);
    }
    function unbatchedUpdates(fn) {
      if (isBatchingUpdates && !isUnbatchingUpdates) {
        try {
          return fn();
        } finally {
          isUnbatchingUpdates = false;
        }
      }
      return fn();
    }
    function finalizeInitialChildren(
      domElement,
      type,
      props,
      rootContainerInstance
    ) {
      setInitialProperties(domElement, type, props, rootContainerInstance);
      return shouldAutoFocusHostComponent(type, props);
    }
    function prepareUpdate(
      domElement,
      tag,
      lastRawProps,
      nextRawProps,
      rootContainerElement
    ) {
      let updatePayload = null;

      let lastProps;
      let nextProps;
      switch (tag) {
        case "input":
        case "option":
        case "select":
        case "textarea":
          lastProps = getHostProps(tag, lastRawProps);
          nextProps = getHostProps(tag, nextRawProps);
          updatePayload = [];
          break;
        default:
          lastProps = lastRawProps;
          nextProps = nextRawProps;
          if (
            typeof lastProps.onClick !== "function" &&
            typeof nextProps.onClick === "function"
          ) {
            trapClickOnNonInteractiveElement(domElement);
          }
          break;
      }
    }
    function shouldSetTextContent(type, props) {
      return (
        type === "textarea" ||
        typeof props.children === "string" ||
        typeof props.children === "number"
      );
    }

    return Object.freeze({
      getPublicRootInstance,
      createInstance,
      createTextInstance,
      createContainer,
      updateContainer,
      unbatchedUpdates,
      finalizeInitialChildren,
      prepareUpdate,
      shouldSetTextContent
    });
  })();

  const ReactDOM = Object.freeze({
    render(element, container, callback) {
      if (getRootHostContainer === null) getRootHostContainer = () => container;
      return renderSubtreeIntoContainer(null, element, container, callback);
    }
  });

  module.exports = ReactDOM;
})();

// ==UserScript==
// @name         Post Saver for DragonsEmpire
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  Позволяет сохранять текущее содержимое поста в локальную память бразуера с привязкой к id-темы. Есть поддержка авто-сохранения с настраиваемой периодичностью.
// @author       YoungTeurus
// @match        http://dragonsempire.mybb.ru/viewtopic.php*
// @icon         https://www.google.com/s2/favicons?domain=mybb.ru
// @grant        none
// ==/UserScript==

(function() {
    // Написано для jquery 3.6.0:
    // https://code.jquery.com/jquery-3.6.0.min.js
    'use strict';

    // Фикс проблем с editor-ом для старого jQuery форума.
    $.browser={ msie: ( navigator.appName == 'Microsoft Internet Explorer') ? true : false }

    // postContainerPrefix должен быть довольно уникальным, чтобы не вызывать проблем с совместимостью
    const postContainerPrefix = "P0ST_C0NTAINER";
    const postContainerDevider = "-";

    // buttonIdPrefix должен быть уникальным для страницы.
    const buttonIdPrefix = "P0ST-C0NTAINER";

    const manualSaveButtonId = "ManualSave";
    const manualSaveButton = $('<input type="submit" class="button submit" value="Сохранить" id="' + buttonIdPrefix + manualSaveButtonId + '">');

    const restoreButtonId = "Restore";
    const restoreButton = $('<input type="submit" class="button submit" value="Восстановить" id="' + buttonIdPrefix + restoreButtonId + '">');

    const toggleAutosaveButtonId = "ToggleAutosave";
    const toggleAutosaveButton = $('<input type="submit" class="button submit" value="" id="' + buttonIdPrefix + toggleAutosaveButtonId + '">');

    const clearSavedPostButtonId = "clearSavedPost";
    const clearSavedPostButton = $('<input type="submit" class="button submit" value="Удалить сохранение" id="' + buttonIdPrefix + clearSavedPostButtonId + '">');

    const autosaveConfigPostfix = "isAutosaveEnabled";

    // Время между автоматическими сохранениями поста:
    const autosavePostIntervalTime = 15;

    const postPreviewLength = 25;

    // const doOnLoad = (func) => {
    //     $(function(){func()});
    // }

    // const addEventListenerToMainReply = () => {
    //     mainReply.on('change keyup paste', function(){
    //         let currentValue = $(this).val();
    //         if (oldMainReplyValue == currentValue){
    //             return;
    //         }
    //         oldMainReplyValue = currentValue;
    //         console.log(currentValue);
    //     });
    // }

    const getURLParametersFromString = (url, parameterSplitter="#") => {
        const _emptyArray = [];

        const unsplittedParameters = url.split("?");
        if (unsplittedParameters.length <= 1){
            alert("::getCurrentThemeIdFromURL: This page has no parameters! How did you make it work?!");
            return _emptyArray;
        }
        const parameters = unsplittedParameters[1].split(parameterSplitter);
        return parameters;
    }

    const getMapOfParamtersFromArray = (paramsArray, keyValueSplitter="=") => {
        let tempMap = Object.create(null);
        if(paramsArray && Array.isArray(paramsArray)){
            paramsArray.forEach( (parameter) => {
                const parameterKeyAndValue = parameter.split(keyValueSplitter);
                const key = parameterKeyAndValue[0];
                let value = null;
                if (parameterKeyAndValue.length > 1){
                    value = parameterKeyAndValue[1];
                }
                tempMap[key] = value;
            });
        }
        return tempMap;
    }

    const getCurrentThemeIdFromURL = (url) => {
        const isCurrentPagePostTheme = url.includes("viewtopic.php");
        if (!isCurrentPagePostTheme){
            alert("::getCurrentThemeIdFromURL: You are not in post theme (viewtopic.php)! How did you make it work?!");
            return null;
        }
        const parameters = getURLParametersFromString(url);
        const parametersMap = getMapOfParamtersFromArray(parameters);
        if (!("id" in parametersMap)){
            console.log("::getCurrentThemeIdFromURL: This page has no 'id' parameter.");
            return null;
        }
        return parametersMap["id"];
    }

    const getKeyValueFromLocalStorage = (key) => {
      return localStorage.getItem(key);
    }

    const checkIfKeyIsInLocalStorage = (key) => {
        const itemValue = getKeyValueFromLocalStorage(key);
        return itemValue != null;
    }

    const setKeyInLocalStorage = (key, value) => {
      localStorage.setItem(key, value);
    }

    const checkIfPostContainerExistsInLocalStorageAndCreateIfNeeded = () => {
      const isPostContainerExists = checkIfKeyIsInLocalStorage(postContainerPrefix);
      if (!isPostContainerExists){
        setKeyInLocalStorage(postContainerPrefix, "1");
        alert("Флаг наличия postContainer-а установлен в локальном хранилище!");
      }
    }

    const getLocalStorageKeyByPageId = (pageId) => {
      return postContainerPrefix + postContainerDevider + pageId.toString();
    }

    const checkIfPageExistsInLocalStorage = (pageId) => {
      const pageContainerKey = getLocalStorageKeyByPageId(pageId);
      return checkIfKeyIsInLocalStorage(pageContainerKey);
    }

    const saveCurrentPageInLocalStorage = () => {
      const currentPageStorageKey = getLocalStorageKeyByPageId(currentThemeId);
      setKeyInLocalStorage(currentPageStorageKey, "1");
    }

    const getCurrentPostText = () => {
      return mainReply.val();
    }

    const saveCurrentMainReplyContentToLocalStorage = () => {
      const currentPageStorageKey = getLocalStorageKeyByPageId(currentThemeId);
      const mainReplyContent = getCurrentPostText();
      setKeyInLocalStorage(currentPageStorageKey, mainReplyContent);
    }

    const getCurrentPageMainReplyContentFromLocalStorage = () => {
      const currentPageStorageKey = getLocalStorageKeyByPageId(currentThemeId);
      return getKeyValueFromLocalStorage(currentPageStorageKey);
    }

    const clearCurrentPageMainReplyContentFromLocalStorage = () => {
      const currentPageStorageKey = getLocalStorageKeyByPageId(currentThemeId);
      setKeyInLocalStorage(currentPageStorageKey, "");
    }

    const setMainReplyText = (text) => {
      mainReply.val(text);
    }

    const returnConfirmationOfRestoringPostContentWithNotEmptyCurrentPost = (loadedContentOfMainReply) => {
      let confirmMessage = "Вы дейстивтельно желаете восстановить следующее содержимое поста: ";
      if (loadedContentOfMainReply.length > postPreviewLength){
        confirmMessage += "'" + loadedContentOfMainReply.substr(0, postPreviewLength) + "...'"
      } else {
        confirmMessage += "'" + loadedContentOfMainReply + "'";
      }
      return confirm(confirmMessage);
    }

    const setRestoreButtonListener = () => {
      restoreButton.on("click", function(event){
        event.preventDefault();
        const loadedContentOfMainReply = getCurrentPageMainReplyContentFromLocalStorage();
        const currentPostText = getCurrentPostText();
        if (loadedContentOfMainReply.length > 0){
          if (currentPostText.length > 0){
            const userAgreed = returnConfirmationOfRestoringPostContentWithNotEmptyCurrentPost(loadedContentOfMainReply);
            if(userAgreed){
              setMainReplyText(loadedContentOfMainReply);
            }
          } else {
            setMainReplyText(loadedContentOfMainReply);
          }
        } else {
          alert("Для данной страницы нет сохранённого поста.");
        }
      });
    }

    const addElementToFormsubmit = (jqueryElement) => {
      const formSubmitRowOfButtons = $(".formsubmit");
      formSubmitRowOfButtons.append(jqueryElement);
    }

    const addRestoreButtonToPage = () => {
      setRestoreButtonListener();
      addElementToFormsubmit(restoreButton);
    }

    const saveCurrentMainReplyContentToLocalStorageIfNotEmptyAndReturnTrueIfSaved = () => {
      const mainReplyContent = getCurrentPostText();
      if (mainReplyContent.length <= 0){
        return false;
      }
      const currentPageStorageKey = getLocalStorageKeyByPageId(currentThemeId);
      setKeyInLocalStorage(currentPageStorageKey, mainReplyContent);
      return true
    }

    const autosaveFunction = () => {
      const wasContentSaved = saveCurrentMainReplyContentToLocalStorageIfNotEmptyAndReturnTrueIfSaved();
      if (wasContentSaved){
        console.log("Автосохранение содержимого поста успешно выполнено!");
      } else {
        console.log("Пустой пост не был сохранён!");
      }
    }

    const startAutosave = () => {
      autosaveIntervalId = setInterval(autosaveFunction, autosavePostIntervalTime * 1000);
      console.log("Автосохранение содержимого поста с интервалом " + autosavePostIntervalTime + " секунд было включено!");
    }

    const isAutosaveActive = () => {
      return autosaveIntervalId != null;
    }

    const stopAutosave = () => {
      if (isAutosaveActive()){
        clearInterval(autosaveIntervalId);
      }
      autosaveIntervalId = null;
      console.log("Автосохранение содержимого поста с интервалом секунд было отключено!");
    } 

    const setButtonText = (button, text) => {
      button.attr("value", text);
    }

    const updateToggleAutosaveButtonText = () => {
      if (isAutosaveActive()){
        setButtonText(toggleAutosaveButton, "Отключить автосохранение");
      } else {
        setButtonText(toggleAutosaveButton, "Включить автосохранение");
      }
    }

    const setToggleAutosaveButtonListener = () => {
      toggleAutosaveButton.on("click",function(event){
        event.preventDefault();
        if(isAutosaveActive()){
          stopAutosave();
          setAutosaveConfigStateDisabled();
        } else {
          startAutosave();
          setAutosaveConfigStateEnabled();
        }
        updateToggleAutosaveButtonText();
      });
    }

    const addToggleAutosaveButtonToPage = () => {
      setToggleAutosaveButtonListener();
      updateToggleAutosaveButtonText();
      addElementToFormsubmit(toggleAutosaveButton);
    }

    const setClearSavedPostButtonListener = () => {
      clearSavedPostButton.on("click", function(){
        event.preventDefault();
        const savedPostFromLocalStorage = getCurrentPageMainReplyContentFromLocalStorage();
        if (savedPostFromLocalStorage.length > 0){
          let confirmMessage = "Вы действительно желаете очистить сохранённый пост для этой страницы? '";
          if (savedPostFromLocalStorage.length > postPreviewLength){
            confirmMessage += savedPostFromLocalStorage.substr(0, postPreviewLength) + "...";
          } else {
            confirmMessage += savedPostFromLocalStorage;
          }
          confirmMessage += "'"

          if (confirm(confirmMessage)){
            clearCurrentPageMainReplyContentFromLocalStorage();
            alert("Сохранённый пост был удалён!");
          }
        }
      });
    }

    const addClearSavedPostButtonToPage = () => {
      setClearSavedPostButtonListener()
      addElementToFormsubmit(clearSavedPostButton);
    }

    const setManualSaveButtonListener = () => {
      manualSaveButton.on("click", function(){
        event.preventDefault();
        const savedPostFromLocalStorage = getCurrentPageMainReplyContentFromLocalStorage();
        if (savedPostFromLocalStorage.length > 0){
          let confirmMessage = "Вы действительно желаете перезаписать сохранённый пост для этой страницы? '";
          if (savedPostFromLocalStorage.length > postPreviewLength){
            confirmMessage += savedPostFromLocalStorage.substr(0, postPreviewLength) + "...";
          } else {
            confirmMessage += savedPostFromLocalStorage;
          }
          confirmMessage += "'"

          if (!confirm(confirmMessage)){
            return; // Если нажали "нет" - не сохраняем пост.
          }
        }
        saveCurrentMainReplyContentToLocalStorage();
        alert("Пост был сохранён!");
      });
    }

    const addManualSaveButtonToPage = () => {
      setManualSaveButtonListener();
      addElementToFormsubmit(manualSaveButton);
    }

    const getAutosaveConfigLocalStorageKey = () => {
      return postContainerPrefix + postContainerDevider + currentThemeId + postContainerDevider + autosaveConfigPostfix;
    }

    const checkAutosaveConfig = () => {
      const autosaveConfigKey = getAutosaveConfigLocalStorageKey();
      const hasAutosaveConfig = checkIfKeyIsInLocalStorage(autosaveConfigKey);
      if (!hasAutosaveConfig){
        setKeyInLocalStorage(autosaveConfigKey, "0");
      }
      const autosaveConfigValue = getKeyValueFromLocalStorage(autosaveConfigKey);
      const isAutosaveConfigEnabled = autosaveConfigValue === "1";
      if (isAutosaveConfigEnabled){
        // Если в настройках сохранено, что автосохранение было включено для данной страницы...
        startAutosave();
        updateToggleAutosaveButtonText();
      }

      console.log("Автосохранение было " + (isAutosaveConfigEnabled ? "включено":"выключено") + " из запомненных настроек!");
    }

    const setAutosaveConfigStateFromBoolean = (state) =>{
      const autosaveConfigKey = getAutosaveConfigLocalStorageKey();
      if (state){
        setKeyInLocalStorage(autosaveConfigKey, "1");
      } else {
        setKeyInLocalStorage(autosaveConfigKey, "0");
      }
    }

    const setAutosaveConfigStateEnabled = () => {
      setAutosaveConfigStateFromBoolean(true);
    }

    const setAutosaveConfigStateDisabled = () => {
      setAutosaveConfigStateFromBoolean(false);
    }

    let oldMainReplyValue = "";
    const localStorage = window.localStorage;
    const mainReply = $("#main-reply");
    const currentPageUrl = window.location.href;
    const currentThemeId = getCurrentThemeIdFromURL(currentPageUrl);
    let autosaveIntervalId = null;

    if (currentThemeId){
        checkIfPostContainerExistsInLocalStorageAndCreateIfNeeded();
        const isCurrentPageExistsInLocalStorage = checkIfPageExistsInLocalStorage(currentThemeId);
        addManualSaveButtonToPage();
        addRestoreButtonToPage();
        addToggleAutosaveButtonToPage();
        addClearSavedPostButtonToPage();
        checkAutosaveConfig();
    }
})();
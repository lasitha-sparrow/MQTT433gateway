/**
  MQTT433gateway - MQTT 433.92 MHz radio gateway utilizing ESPiLight
  Project home: https://github.com/puuu/MQTT433gateway/

  The MIT License (MIT)

  Copyright (c) 2017, 2018 Jan Losinski, Puuu

  Permission is hereby granted, free of charge, to any person
  obtaining a copy of this software and associated documentation files
  (the "Software"), to deal in the Software without restriction,
  including without limitation the rights to use, copy, modify, merge,
  publish, distribute, sublicense, and/or sell copies of the Software,
  and to permit persons to whom the Software is furnished to do so,
  subject to the following conditions:

  The above copyright notice and this permission notice shall be
  included in all copies or substantial portions of the Software.

  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
  EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
  MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
  NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS
  BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN
  ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
  CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
  SOFTWARE.
*/

require('purecss/build/pure-min.css');
require('purecss/build/grids-responsive-min.css');
require('../css/style.css');
/* global $ */

$(() => {
  'strict mode';

  const CONFIG_ITEMS = [
    new GroupItem('General Config', legendFactory),
    new ConfigItem('deviceName', deviceNameInputFactory, inputApply, inputGet, 'The general name of the device'),
    new ConfigItem('configPassword', devicePasswordInputFactory, devicePasswordApply, inputGet, 'The admin password for the web UI (min. 8 characters)'),

    new GroupItem('MQTT Config', legendFactory),
    new ConfigItem('mqttBroker', hostNameInputFactory, inputApply, inputGet, 'MQTT Broker host'),
    new ConfigItem('mqttBrokerPort', portNumberInputFactory, inputApply, inputGetInt, 'MQTT Broker port'),
    new ConfigItem('mqttUser', inputFieldFactory, inputApply, inputGet, 'MQTT username (optional)'),
    new ConfigItem('mqttPassword', passwordFieldFactory, inputApply, inputGet, 'MQTT password (optional)'),
    new ConfigItem('mqttRetain', checkboxFactory, checkboxApply, checkboxGet, 'Retain MQTT messages'),

    new GroupItem('MQTT Topic Config', legendFactory),
    new ConfigItem('mqttReceiveTopic', mqttTopicInputFactory, inputApply, inputGet, 'Topic to publish received signal'),
    new ConfigItem('mqttSendTopic', mqttTopicInputFactory, inputApply, inputGet, 'Topic to get signals to send from'),
    new ConfigItem('mqttStateTopic', mqttTopicInputFactory, inputApply, inputGet, 'Topic to publish the device state'),
    new ConfigItem('mqttVersionTopic', mqttTopicInputFactory, inputApply, inputGet, 'Topic to publish the current device version'),

    new GroupItem('433MHz RF Config', legendFactory),
    new ConfigItem('rfEchoMessages', checkboxFactory, checkboxApply, checkboxGet, 'Echo sent rf messages back'),
    new ConfigItem('rfReceiverPin', pinNumberInputFactory, inputApply, inputGetInt, 'The GPIO pin used for the rf receiver'),
    new ConfigItem('rfReceiverPinPullUp', checkboxFactory, checkboxApply, checkboxGet, 'Activate pullup on rf receiver pin (required for 5V protection with reverse diode)'),
    new ConfigItem('rfTransmitterPin', pinNumberInputFactory, inputApply, inputGetInt, 'The GPIO pin used for the RF transmitter'),

    new GroupItem('Enabled RF protocols', legendFactory),
    new ConfigItem('rfProtocols', protocolInputField, protocolApply, protocolGet, ''),

    new GroupItem('Log Config', legendFactory),
    new ConfigItem('serialLogLevel', logLevelInputFactory, inputApply, inputGet, 'Level for serial logging'),
    new ConfigItem('webLogLevel', logLevelInputFactory, inputApply, inputGet, 'Level for logging to the web UI'),
    new ConfigItem('syslogLevel', logLevelInputFactory, inputApply, inputGet, 'Level for syslog logging'),
    new ConfigItem('syslogHost', hostNameInputFactory, inputApply, inputGet, 'Syslog server (optional)'),
    new ConfigItem('syslogPort', portNumberInputFactory, inputApply, inputGetInt, 'Syslog port (optional)'),

    new GroupItem('Status LED', legendFactory),
    new ConfigItem('ledPin', pinNumberInputFactory, inputApply, inputGetInt, 'The GPIO pin used for the status LED'),
    new ConfigItem('ledActiveHigh', checkboxFactory, checkboxApply, checkboxGet, 'The way how the LED is connected to the pin (false for built-in led)'),
  ];

  const DEBUG_FLAGS = {
    protocolRaw: 'Enable Raw RF message logging',
    systemLoad: 'Show the processed loop() iterations for each second',
    freeHeap: 'Show the free heap memory every second',
  };

  const SystemCommandActions = {
    restart() {
      const body = $('body');
      body.empty();
      body.append('<p>Device will reboot!</p><p>Try to reconnect in 15 seconds.</p>');
      setTimeout(() => {
        window.location.reload(true);
      }, 15000);
    },
    reset_wifi() {
      const body = $('body');
      body.empty();
      body.append('<p>Devices WIFI settings where cleared!</p><p>Please reconfigure it.</p>');
    },
    reset_config() {
      const body = $('body');
      body.empty();
      body.append('<p>Devices Config was reset - reboot device!</p>'
                + '<p>You might have to reconfigure the wifi!</p>'
                + '<p>Reload page in 10 seconds...</p>');
      setTimeout(() => {
        window.location.reload(true);
      }, 10000);
    },
  };

  function ConfigItem(name, factory, apply, fetch, help) {
    this.name = name;
    this.factory = factory;
    this.apply = apply;
    this.fetch = fetch;
    this.help = help;
  }

  function GroupItem(name, factory) {
    this.name = name;
    this.container = true;
    this.factory = factory;
  }

  function inputLabelFactory(item) {
    return $('<label>', {
      text: item.name,
      for: `cfg-${item.name}`,
    });
  }

  function inputHelpFactory(item) {
    return $('<span>', {
      class: 'pure-form-message',
      text: item.help,
    });
  }

  function logLevelInputFactory(item) {
    const element = $('<select>', {
      class: 'config-item',
      id: `cfg-${item.name}`,
      name: item.name,
    }).append([
      $('<option>', { value: '', text: 'None' }),
      $('<option>', { value: 'error', text: 'Error' }),
      $('<option>', { value: 'warning', text: 'Warning' }),
      $('<option>', { value: 'info', text: 'Info' }),
      $('<option>', { value: 'debug', text: 'Debug' }),
    ]);
    registerConfigUi(element, item);
    return [
      inputLabelFactory(item),
      element,
      inputHelpFactory(item),
    ];
  }

  function inputFieldFactory(item, pattern, required) {
    const element = $('<input>', {
      type: 'text',
      class: 'pure-input-1 config-item',
      id: `cfg-${item.name}`,
      pattern,
      required,
      name: item.name,
    });
    registerConfigUi(element, item);
    return [
      inputLabelFactory(item),
      element,
      inputHelpFactory(item),
    ];
  }

  function deviceNameInputFactory(item) {
    return inputFieldFactory(item, '[.-_A-Za-z0-9]+', true);
  }

  function hostNameInputFactory(item) {
    return inputFieldFactory(item, '[.-_A-Za-z0-9]*');
  }

  function mqttTopicInputFactory(item) {
    return inputFieldFactory(item, undefined, true);
  }

  function inputFieldNumberFactory(item, min, max) {
    const element = $('<input>', {
      type: 'number',
      class: 'pure-input-1 config-item',
      id: `cfg-${item.name}`,
      name: item.name,
      min,
      max,
    });
    registerConfigUi(element, item);
    return [
      inputLabelFactory(item),
      element,
      inputHelpFactory(item),
    ];
  }

  function portNumberInputFactory(item) {
    return inputFieldNumberFactory(item, 1, 65535);
  }

  function pinNumberInputFactory(item) {
    return inputFieldNumberFactory(item, 0, 16);
  }

  function passwordFieldFactory(item, minlength) {
    const element = $('<input>', {
      type: 'password',
      class: 'pure-input-1 config-item',
      id: `cfg-${item.name}`,
      name: item.name,
      minlength,
    });
    registerConfigUi(element, item);
    return [
      inputLabelFactory(item),
      element,
      inputHelpFactory(item),
    ];
  }

  function devicePasswordInputFactory(item) {
    const properties = {
      type: 'password',
      class: 'pure-input-1 config-item',
      minlength: 8,
    };
    const element1 = $('<input>', $.extend(properties, {
      id: `cfg-${item.name}`,
      name: item.name,
    }));
    const element2 = $('<input>', $.extend(properties, {
      id: `cfg-${item.name}-confirm`,
      name: `${item.name}-confirm`,
    }));
    function validatePassword(event) {
      let message = '';
      if (element1.val() !== element2.val()) {
        message = "Passwords don't match!";
      }
      element1.get(0).setCustomValidity(message);
      element2.get(0).setCustomValidity(message);
    }
    registerConfigUi(element1, item);
    registerConfigUi(element2, item);
    element1.on('input', validatePassword);
    element2.on('input', validatePassword);
    return [
      inputLabelFactory(item),
      element1,
      inputLabelFactory({ name: `${item.name} (confirm)` }),
      element2,
      inputHelpFactory(item),
    ];
  }

  function checkboxFactory(item) {
    const element = $('<input>', {
      type: 'checkbox',
      class: 'config-item',
      id: `cfg-${item.name}`,
      name: item.name,
    });
    registerConfigUi(element, item);
    return $('<label>', {
      class: 'pure-checkbox',
    }).append([
      element,
      ` ${item.name}`,
      inputHelpFactory(item),
    ]);
  }

  function legendFactory(item) {
    return $('<fieldset>', { class: 'config-group' }).append(
      $('<legend>', { text: item.name }),
    );
  }

  let protocols;
  function protocolInputField(item) {
    const container = $('<div>', {
      id: `cfg-${item.name}`,
      class: 'pure-g',
    });
    registerConfigUi(container, item);
    function protocolListFactory(protos) {
      protos.forEach((value) => {
        const element = $('<input>', {
          type: 'checkbox',
          class: 'config-item protocols-item',
          id: `cfg-${item.name}-${value}`,
          name: item.name,
          value,
        });
        container.append($('<div>', {
          class: 'pure-u-1 pure-u-md-1-2 pure-u-lg-1-3 pure-u-xl-1-4',
        }).append($('<label>', {
          class: 'pure-checkbox',
        }).append([
          element,
          ` Protocol ${value}`,
        ])));
      });
      protocols = protos;
    }
    $.ajax({
      url: '/protocols',
      type: 'GET',
      contentType: 'application/json',
      success: protocolListFactory,
    });
    return container;
  }

  function inputApply(itemName, data) {
    $(`#cfg-${itemName}`).val(data);
  }

  function devicePasswordApply(itemName, data) {
    $(`#cfg-${itemName}`).val(data);
    $(`#cfg-${itemName}-confirm`).val(data);
  }

  function checkboxApply(itemName, data) {
    $(`#cfg-${itemName}`).prop('checked', data);
  }

  function protocolApply(itemName, data) {
    if (protocols === undefined) {
      setTimeout(protocolApply(itemName, data), 100);
      return;
    }
    if (data.length === 0) {
      data = protocols;
    }
    data.forEach((value) => {
      $(`#cfg-${itemName}-${value}`).prop('checked', true);
    });
  }

  function inputGet(element) {
    if (!element.get(0).checkValidity()) {
      return undefined;
    }
    return element.val();
  }

  function inputGetInt(element) {
    return parseInt(inputGet(element), 10);
  }

  function checkboxGet(element) {
    return element.prop('checked');
  }

  function protocolGet(element) {
    const checked = $('.protocols-item:checked');
    if ($('.protocols-item').length === checked.length) {
      return [];
    }
    return $.map(checked, x => $(x).val());
  }

  let lastConfig = {};
  let changes = {};
  function registerConfigUi(element, item) {
    element.change((event) => {
      const newData = item.fetch(element);
      if (newData !== undefined) {
        if (JSON.stringify(lastConfig[item.name]) !== JSON.stringify(newData)) {
          changes[item.name] = newData;
        } else {
          delete changes[item.name];
        }
      }
    });
  }

  function throttle(callback, limit) {
    let wait = false;
    return (...args) => {
      if (!wait) {
        callback.apply(this, args);
        wait = true;
        setTimeout(() => {
          wait = false;
        }, limit);
      }
    };
  }

  function initConfigUi() {
    function applyConfig(data) {
      CONFIG_ITEMS.forEach((item) => {
        if (item.apply) {
          item.apply(item.name, data[item.name]);
        }
      });
      changes = {};
      lastConfig = data;
    }

    function loadConfig() {
      $.ajax({
        url: '/config',
        type: 'GET',
        contentType: 'application/json',
        success: applyConfig,
      });
    }

    const settings = $('#settings');
    let container;
    CONFIG_ITEMS.forEach((item) => {
      const result = item.factory(item);
      if (item.container) {
        result.appendTo(settings);
        container = result;
      } else {
        container.append(result);
      }
    });
    loadConfig();
    $('#settings-form').submit((event) => {
      event.preventDefault();
      let onSuccess = applyConfig;
      if ('configPassword' in changes) {
        // reload after new password to force password question
        onSuccess = loadConfig;
      }
      if (('deviceName' in changes)
                && (window.location.hostname.toLowerCase() === `${lastConfig.deviceName.toLowerCase()}.local`)) {
        const onSuccessOld = onSuccess;
        onSuccess = function (data) {
          if (confirm('deviceName was changed. Did you like to reload with new deviceName?')) {
            const mdnsname = `${changes.deviceName}.local`;
            const url = `${window.location.protocol}//${mdnsname}`;
            location.assign(url);
            body.empty();
            body.append(`<a href="${url}">${mdnsname}</a>`);
          } else {
            return onSuccessOld(data);
          }
        };
      }
      $.ajax({
        url: '/config',
        type: 'PUT',
        contentType: 'application/json',
        data: JSON.stringify(changes),
        success: onSuccess,
      });
      return false;
    });
    $('#cfg-form-reset').click((event) => {
      event.preventDefault();
      loadConfig();
      return false;
    });
  }

  function initDebugUi(debugFlags, container) {
    function create(debugFlag, helpText) {
      const checkbox = $('<input>', {
        type: 'checkbox',
        class: 'debug-item',
        id: `debug-${debugFlag}`,
        name: debugFlag,
      });
      checkbox.change(function (event) {
        submit(this);
      });
      return $('<div>', {
        class: 'pure-u-1 pure-u-md-1-3',
      }).append($('<label>', { class: 'pure-checkbox' }).append([
        checkbox,
        ` ${debugFlag}`,
        $('<span>', {
          class: 'pure-form-message',
          text: helpText,
        }),
      ]));
    }

    function apply(data) {
      $.each(data, (key, value) => {
        $(`#debug-${key}`).prop('checked', value);
      });
    }

    function submit(item) {
      const data = {};
      data[item.name] = item.checked;
      $.ajax({
        url: '/debug',
        type: 'PUT',
        data: JSON.stringify(data),
        contentType: 'application/json',
        success: apply,
      });
    }

    $.each(debugFlags, (debugFlag, helpText) => {
      container.append(create(debugFlag, helpText));
    });
    $.ajax({
      url: '/debug',
      type: 'GET',
      contentType: 'application/json',
      success: apply,
    });
  }

  const sendCommand = throttle(
    (params) => {
      $.ajax({
        url: '/system',
        type: 'POST',
        data: JSON.stringify(params),
        contentType: 'application/json',
        success() {
          SystemCommandActions[params.command]();
        },
      });
    },
    1000,
  );

  $('.system-btn').click(function (event) {
    sendCommand({ command: $(this).data('command') });
  });

  function loadFwVersion() {
    $.ajax({
      url: '/firmware',
      type: 'GET',
      contentType: 'application/json',
      success(data) {
        $('#current-fw-version').text(data.version);
        $('#chip-id').text(data.chipId);
        const container = $('#fw-build-with');
        container.empty();
        $.each(data.build_with, (dependency, version) => {
          container.append($('<li>', { text: `${dependency}: ${version}` }));
        });
      },
    });
  }

  function openWebSocket() {
    const pre = $('#log-container');

    const webSocket = new WebSocket(`ws://${location.hostname}:81`);
    let tm;

    function showState(state) {
      $('#log-status').text(state);
    }

    function ping() {
      clearTimeout(tm);
      tm = setTimeout(() => {
        webSocket.send('__PING__');
        tm = setTimeout(() => {
          showState('Broken!');
          webSocket.close();
          webSocket.onerror = undefined;
          openWebSocket();
        }, 2000);
      }, 5000);
    }

    webSocket.onmessage = function (event) {
      const message = event.data;

      if (message === '__PONG__') {
        ping();
        return;
      }

      const element = pre.get(0);
      const isScrollDown = (element.scrollTop === element.scrollHeight - element.clientHeight);
      pre.append(message);
      if (isScrollDown) {
        // scroll down if current bottom is shown
        element.scrollTop = element.scrollHeight - element.clientHeight;
      }
    };

    webSocket.onerror = function (event) {
      webSocket.close();
      if (tm === undefined) {
        showState('Error');
        openWebSocket();
      }
    };

    webSocket.onopen = function (event) {
      loadFwVersion();
      showState('Connected!');
      ping();
    };
  }
  // Clear log
  $('#btn-clear-log').click((event) => {
    $('#log-container').empty();
  });

  initConfigUi();
  initDebugUi(DEBUG_FLAGS, $('#debugflags'));
  openWebSocket();
});

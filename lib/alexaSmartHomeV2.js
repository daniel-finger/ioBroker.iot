'use strict';

function AlexaSH2(adapter) {
    let Actions       = require('../admin/actions');
    let smartDevices  = [];
    let enums         = [];
    let valuesON      = {};
    let lang          = 'de';
    let translate     = false;
    let addedId       = null;

    let translateRooms;
    let translateFunctions;
    let translateDevices;
    const words         = {
        'No name':  {'en': 'No name', 'de': 'Kein Name', 'ru': 'Нет имени'},
        'Group':    {'en': 'Group',   'de': 'Gruppe',    'ru': 'Группа'}
    };

    this.setLanguage = function (_lang, _translate) {
        lang = _lang;
        translate = _translate;
    };

    /* function validateName(name) {
        if (!name) return false;

        for (let n = 0; n < name.length; n++) {
            if (name[n] === ';' || name[n] === '.' || name[n] === '-' || name[n] === ':') return false;
        }

        return true;
    } */

    function getSmartName(states, id) {
        if (!id) {
            if (!adapter.config.noCommon) {
                return states.common.smartName;
            } else {
                return (states &&
                    states.common &&
                    states.common.custom &&
                    states.common.custom[adapter.namespace]) ?
                    states.common.custom[adapter.namespace].smartName : undefined;
            }
        } else
        if (!adapter.config.noCommon) {
            return states[id].common.smartName;
        } else {
            return (states[id] &&
                states[id].common &&
                states[id].common.custom &&
                states[id].common.custom[adapter.namespace]) ?
                states[id].common.custom[adapter.namespace].smartName || null : null;
        }
    }

    function padding(num) {
        num = num.toString(16);
        if (num.length < 2) num = '0' + num;
        return num;
    }

    function writeResponse(applianceId, operation, value) {
        for (let d = 0; d < smartDevices.length; d++) {
            if (smartDevices[d].applianceId === applianceId) {
                let text;
                let obj = smartDevices[d];
                switch (operation) {
                    case 'ONOFF':
                        if (value) {
                            if (lang === 'de') {
                                text = `${obj.friendlyName} ist <emphasis>eingeschaltet</emphasis>!`;
                            } else if (lang === 'ru') {
                                text = `${obj.friendlyName} в состоянии включено`;
                            } else {
                                text = `${obj.friendlyName} turned on`;
                            }
                        } else {
                            if (lang === 'de') {
                                text = `${obj.friendlyName} ist <emphasis>ausgeschaltet</emphasis>!`;
                            } else if (lang === 'ru') {
                                text = `${obj.friendlyName} в состоянии <emphasis>выключено</emphasis>`;
                            } else {
                                text = `${obj.friendlyName} turned off`;
                            }
                        }
                        break;

                    case '%':
                        if (lang === 'de') {
                            text = `${obj.friendlyName} wird auf ${value} Prozent <emphasis>gesetzt</emphasis>`;
                        } else if (lang === 'ru') {
                            text = `Состояние ${obj.friendlyName} <emphasis>установлено</emphasis> на ${value}`;
                        } else {
                            text = `${obj.friendlyName} set to ${value} <emphasis>percent</emphasis>`;
                        }
                        break;

                    case '<>':
                        if (value >= 0) {
                            if (lang === 'de') {
                                text = `${obj.friendlyName} ist <emphasis>erhöht</emphasis> um ${value} Prozent`;
                            } else if (lang === 'ru') {
                                text = `Состояние ${obj.friendlyName} <emphasis>увеличено</emphasis> на ${value}`;
                            } else {
                                text = `${obj.friendlyName} <emphasis>increased</emphasis> on ${value} percent`;
                            }
                            value = '+' + value;
                        } else {
                            if (lang === 'de') {
                                text = `${obj.friendlyName} ist <emphasis>verkleinert</emphasis> um ${value} Prozent`;
                            } else if (lang === 'ru') {
                                text = `Состояние ${obj.friendlyName} <emphasis>уменьшено</emphasis> на ${value}`;
                            } else {
                                text = `${obj.friendlyName} <emphasis>decreased</emphasis> on ${value} percent`;
                            }
                            value = '-' + value;
                        }
                        break;
                }
                if (text) {
                    adapter.setState('smart.lastResponse', text, true);
                    if (adapter.config.responseOID) {
                        adapter.setForeignState(adapter.config.responseOID, text, false);
                    }

                    adapter.setState('smart.lastFunction', obj.additionalApplianceDetails.func, true);
                    adapter.setState('smart.lastRoom',     obj.additionalApplianceDetails.room, true);
                    adapter.setState('smart.lastCommand',  value, true);
                }
                return;
            }
        }
        adapter.log.warn(`[ALEXA] Unknown applianceId: ${applianceId}`);
    }

    /*function findRole(states, id, role) {
        let parts = id.split('.');
        parts.pop();
        let channel = parts.join('.') + '.';
        for (const i in states) {
            if (states.hasOwnProperty(i) &&
                i.substring(0, channel.length) === channel &&
                i !== id &&
                states[i].common &&
                states[i].common.role === role) {
                return i;
            }
        }
        return null;
    }*/

    function processState(states, id, room, func, alexaIds, groups, names, result) {
        // Make sure to also add other needed Endpoints:
        /*adapter.log.debug('[ALEXA] Process: ' + id);
        if(states[id].common.role == 'level.color.hue') {
            let sat = findRole(states,id,'level.color.saturation');
            let bri = findRole(states,id,'level.dimmer');
            let on = findRole(states,id,'switch');
            adapter.log.debug('[ALEXA] Adding needed: ' + sat +  ' ' + bri + ' ' + on);
            if(sat) processState(states, sat, room, func, alexaIds, groups, names, result);
            if(bri) processState(states, bri, room, func, alexaIds, groups, names, result);
            if(on) processState(states, on, room, func, alexaIds, groups, names, result);
        }*/

        try {
            let friendlyName = getSmartName(states, id);
            let nameModified = false;
            let byON;
            let smartType;
            if (!id) {
                return 'id is empty';
            }

            if (states[id] && states[id].native) {
                // try to convert old notation to new one
                if (!adapter.config.noCommon) {
                    if (states[id].native.byON) {
                        byON = states[id].native.byON;
                        delete states[id].native.byON;
                        let smartName = states[id].common.smartName;

                        if (!smartName || typeof smartName !== 'object') {
                            smartName = {
                                byON:   byON,
                                en:     smartName
                            };
                            smartName[lang] = smartName.en;
                        } else {
                            smartName.byON = byON;
                        }
                        states[id].common.smartName = smartName || {};
                        friendlyName = states[id].common.smartName;
                    } else if (typeof states[id].common.smartName === 'string') {
                        let nnn = states[id].common.smartName;
                        states[id].common.smartName = {};
                        states[id].common.smartName[lang] = nnn;
                        friendlyName = states[id].common.smartName;
                    }
                }
            } else {
                adapter.log.debug(`[ALEXA] Invalid state "${id}". Not exist or no native part.`);
                return `"${id}" not exists or no native part.`;
            }

            byON      = friendlyName && typeof friendlyName === 'object' ? friendlyName.byON      : '';
            smartType = friendlyName && typeof friendlyName === 'object' ? friendlyName.smartType : null;

            if (typeof friendlyName === 'object' && friendlyName) {
                friendlyName = friendlyName[lang] || friendlyName.en;
            }

            if (friendlyName === 'ignore' || friendlyName === false) {
                return `"${id}" must be ignored, because of the settings`;
            }

            if (!friendlyName && !room && !func) {
                return `No friendly name and no room or function found for "${id}"`;
            }

            if (room && typeof room === 'object') {
                room = room[lang] || room.en;
            }
            if (func && typeof func === 'object') {
                func = func[lang] || func.en;
            }
            let friendlyNames = [];
            if (!friendlyName) {
                if (room) {
                    // translate room
                    if (translate) {
                        translateRooms     = translateRooms     || require('./rooms.js');
                        translateFunctions = translateFunctions || require('./functions.js');
                        room = translateRooms(lang, room);
                        func = translateFunctions(lang, func);
                    }

                    if (adapter.config.functionFirst) {
                        if (lang === 'en') {
                            friendlyName = `${func}${adapter.config.concatWord ? ' ' + adapter.config.concatWord : ''} ${room}`;
                        } else {
                            friendlyName = `${func}${adapter.config.concatWord ? ' ' + adapter.config.concatWord : ''} ${room}`;
                        }
                    } else {
                        if (lang === 'en') {
                            friendlyName = `${room}${adapter.config.concatWord ? ' ' + adapter.config.concatWord : ''} ${func}`;
                        } else {
                            friendlyName = `${room}${adapter.config.concatWord ? ' ' + adapter.config.concatWord : ''} ${func}`;
                        }
                    }
                } else {
                    friendlyName = states[id].common.name;
                    if (adapter.config.replaces) {
                        for (let r = 0; r < adapter.config.replaces.length; r++) {
                            friendlyName = friendlyName.replace(adapter.config.replaces[r], '');
                        }
                    }
                }
                friendlyNames[0] = friendlyName;
                nameModified = false;
            } else if (translate) {
                translateDevices = translateDevices || require('./devices.js');
                friendlyName = translateDevices(lang, friendlyName);
                nameModified = true;
                friendlyNames = friendlyName.split(',');
            } else {
                friendlyNames = friendlyName.split(',');
                nameModified = true;
            }
            for (let i = friendlyNames.length - 1; i >= 0; i--) {
                friendlyNames[i] = (friendlyNames[i] || '').trim();
                if (!friendlyNames[i]) {
                    friendlyNames.splice(i, 1);
                } else {
                    // friendlyName may not be longer than 128
                    friendlyNames[i] = friendlyNames[i].substring(0, 128).replace(/[^.a-zA-Z0-9äÄüÜöÖßÉéÈèÀàÂâÊêÙùÛûÇçÎîËëÏïŸÿÔôŒœãõìòáíóú]+/g, ' ');
                }
            }

            if (!friendlyNames[0]) {
                adapter.log.warn(`[ALEXA] State ${id} is invalid.`);
                return `State "${id}" has invalid friendly name`;
            }

            let friendlyDescription = states[id].common.name || id;
            if (typeof friendlyDescription === 'object') {
                friendlyDescription = friendlyDescription[lang] || friendlyDescription.en;
            }

            let res = Actions.getActions(states[id]);
            if (!res) {
                adapter.log.debug(`[ALEXA] Name "${friendlyDescription}" cannot be written and will be ignored`);
                return `State "${id}" cannot be written and will be ignored`;
            }
            let type    = res.type;
            let actions = res.actions;

            friendlyDescription = friendlyDescription.substring(0, 128).replace(/[^.a-zA-Z0-9äÄüÜöÖßÉéÈèÀàÂâÊêÙùÛûÇçÎîËëÏïŸÿÔôŒœãõìòáíóú]+/g, ' ');
            // any letter or number and _ - = # ; : ? @ &
            // let applianceId = id.substring(0, 256).replace(/[^a-zA-Z0-9_=#;:?@&-]+/g, '_');

            let pos;
            if (alexaIds && (pos = alexaIds.indexOf(id)) !== -1) {
                alexaIds.splice(pos, 1);
            }

            type = type ? (byON || '100') : false;
            let name = states[id].common.name || '';
            if (typeof name === 'object') {
                name = name[lang] || name.en;
            }
            name = name.substring(0, 128);

            for (let n = 0; n < friendlyNames.length; n++) {
                if (names[friendlyNames[n]]) {
                    // Ignore it, because yet in the list
                    if (names[friendlyNames[n]].additionalApplianceDetails.id === id) {
                        return;
                    }

                    // create virtual group
                    if (groups[friendlyNames[n]]) {
                     /* //  let ids    = JSON.parse(groups[friendlyNames[n]].additionalApplianceDetails.ids);
                        let _names = JSON.parse(groups[friendlyNames[n]].additionalApplianceDetails.names || '[]');
                        let types  = JSON.parse(groups[friendlyNames[n]].additionalApplianceDetails.byONs || '[]');
                       // ids.push(id);
                        _names.push(name);
                        types.push(type);

                        // merge actions
                        for (let a = 0; a < actions.length; a++) {
                            if (!groups[friendlyNames[n]].actions.includes(actions[a])) {
                                groups[friendlyNames[n]].actions.push(actions[a]);
                            }
                        }

                       // groups[friendlyNames[n]].additionalApplianceDetails.ids   = JSON.stringify(ids);
                        groups[friendlyNames[n]].additionalApplianceDetails.names = JSON.stringify(_names);
                        groups[friendlyNames[n]].additionalApplianceDetails.byONs = JSON.stringify(types);*/

                        actions.forEach(action =>
                            !groups[friendlyNames[n]].actions.includes(action) && groups[friendlyNames[n]].actions.push(action));

                        if (smartType && !groups[friendlyNames[n]].applianceTypes.includes(smartType)) {
                            groups[friendlyNames[n]].applianceTypes.push(smartType);
                        }

                        groups[friendlyNames[n]].additionalApplianceDetails.byONs[id] = type;
                        groups[friendlyNames[n]].additionalApplianceDetails.names[id] = name;
                        groups[friendlyNames[n]].additionalApplianceDetails.smartTypes[id] = smartType;
                        let addids = [id];
                        for (let i = 0; i < addids.length; i++) {
                            let newid = addids[i];
                            let _parts = newid.split('.');
                            _parts.pop();
                            let channel = _parts.join('.');
                            if (groups[friendlyNames[n]].additionalApplianceDetails.channels.hasOwnProperty(channel)) {
                                groups[friendlyNames[n]].additionalApplianceDetails.channels[channel].push({id: newid, role: states[addids[i]].common.role, actions});
                            } else {
                                groups[friendlyNames[n]].additionalApplianceDetails.channels[channel] = [{id: newid, role: states[addids[i]].common.role, actions}];
                            }
                        }
                    } else {
                        // convert single device into group, because at least two devices found with the sama name
                        groups[friendlyNames[n]] = {
                            applianceId:		 friendlyNames[n].replace(/[^a-zA-Zа-яА-Я0-9_=#;:?@&-]+/g, '_'),
                            applianceTypes:      JSON.parse(JSON.stringify(names[friendlyNames[n]].applianceTypes)),
                            manufacturerName:	 'ioBroker group',
                            modelName:		     (name || words['No name'][lang]).substring(0, 128),
                            version:			 '1',
                            friendlyName:		 friendlyNames[n],
                            friendlyDescription: words['Group'][lang] + ' ' + friendlyNames[n],
                            isReachable:         true,
                            actions:             JSON.parse(JSON.stringify(actions)),
                            additionalApplianceDetails: {
                                group:      true,
                                channels:   {},
                                smartTypes: {},
                                names:      {},
                                byONs:      {},
                                room:       room,
                                func:       func
                            }
                        };

                        const oldActions = names[friendlyNames[n]].actions;
                        // merge actions for the first group, too!
                        for (let a = 0; a < oldActions.length; a++) {
                            if (!groups[friendlyNames[n]].actions.includes(oldActions[a])) {
                                groups[friendlyNames[n]].actions.push(oldActions[a]);
                            }
                        }

                        let oldObjDetails = names[friendlyNames[n]].additionalApplianceDetails;

                        if (smartType && !groups[friendlyNames[n]].applianceTypes.includes(smartType)) {
                            groups[friendlyNames[n]].applianceTypes.push(smartType);
                        }

                        groups[friendlyNames[n]].additionalApplianceDetails.byONs[oldObjDetails.id] = oldObjDetails.byON;
                        groups[friendlyNames[n]].additionalApplianceDetails.names[oldObjDetails.id] = oldObjDetails.name;
                        groups[friendlyNames[n]].additionalApplianceDetails.smartTypes[oldObjDetails.id] = oldObjDetails.smartType;
                        groups[friendlyNames[n]].additionalApplianceDetails.byONs[id] = type;
                        groups[friendlyNames[n]].additionalApplianceDetails.names[id] = name;
                        groups[friendlyNames[n]].additionalApplianceDetails.smartTypes[id] = smartType;

                        let addids = [names[friendlyNames[n]].additionalApplianceDetails.id, id];
                        for (let i = 0; i < addids.length; i++) {
                            let newid = addids[i];
                            let _parts = newid.split('.');
                            _parts.pop();
                            let channel = _parts.join('.');
                            if (groups[friendlyNames[n]].additionalApplianceDetails.channels.hasOwnProperty(channel)) {
                                groups[friendlyNames[n]].additionalApplianceDetails.channels[channel].push({id: newid, role: states[addids[i]].common.role, actions: newid === id ? actions: oldActions});
                            } else {
                                groups[friendlyNames[n]].additionalApplianceDetails.channels[channel] = [{id: newid, role: states[addids[i]].common.role, actions: newid === id ? actions: oldActions}];
                            }
                        }

                        result.push(groups[friendlyNames[n]]);
                        names[friendlyNames[n]].disabled = true;
                    }
                } else {
                    const obj = {
                        applianceId:		 friendlyNames[n].replace(/[^a-zA-Zа-яА-Я0-9_=#;:?@&-]+/g, '_'),
                        applianceTypes: [],
                        manufacturerName:	 'ioBroker',
                        modelName:		     (name || words['No name'][lang]).substring(0, 128),
                        version:			 '1',
                        friendlyName:		 friendlyNames[n],
                        friendlyDescription: friendlyDescription,
                        isReachable:         true,
                        actions:             JSON.parse(JSON.stringify(actions)),
                        additionalApplianceDetails: {
                            id:            id.substring(0, 1024),
                            role:          states[id].common.role,
                            name,
                            friendlyNames: friendlyNames.join(', '),
                            smartType,
                            byON:          type,
                            nameModified,
                            room,
                            func
                        }
                    };
                    names[friendlyNames[n]] = obj;
                    smartType && names[friendlyNames[n]].applianceTypes.push(smartType);
                    result.push(obj);
                }
            }
        } catch (e) {
            adapter.log.error(`[ALEXA] Cannot process "${id}": ${e}`);
            return `Error by processing of "${id}": ${e}`;
        }
    }

    function controlOnOff(toggle, id, value, writeStates, callback) {
        adapter.getForeignObject(id, function (err, obj) {
            if (!obj || obj.type !== 'state') {
                err && adapter.log.error(`[ALEXA] Cannot control non state: ${id} ${obj ? obj.type : 'no object'}`);
                return callback && callback();
            }
            let smartName = getSmartName(obj);
            let byON = (smartName && typeof smartName === 'object') ? smartName.byON : null;

            if (toggle && toggle !== id){
                adapter.log.debug(`[ALEXA] Won't control ${id} as we have a switch available.`);
                return callback && callback();
            }

            if (obj.common.type === 'number') {

                // if ON
                if (value) {
                    if (byON === 'stored' && valuesON[id]) {
                        adapter.log.debug(`[ALEXA] Use stored ON value for "${id}": ${valuesON[id]}`);
                        value = valuesON[id];
                    } else {
                        const min = typeof obj.common.min !== 'undefined' ? obj.common.min : 0;
                        const max = typeof obj.common.max !== 'undefined' ? obj.common.max : 100;

                        value = byON ? Math.round(((parseFloat(byON) || 100) * (max - min) / 100) + min) : max;
                    }
                } else {
                    // if OFF
                    if (byON === 'stored') {
                        // remember last state
                        adapter.getForeignState(id, function (err, state) {
                            err && adapter.log.error(`[ALEXA] Cannot get state: ${err}`);

                            if (typeof obj.common.min !== 'undefined') {
                                value = obj.common.min;
                            } else {
                                value = 0;
                            }
                            // do not remember the minimum/off value
                            if (state && state.val !== value) valuesON[id] = state.val;

                            adapter.log.debug(`[ALEXA] OFF Stored: Set "${id}" to ${value} and store old value "${id}"`);

                            adapter.setForeignState(id, value, err => {
                                err && adapter.log.error(`[ALEXA] Cannot switch device: ${err}`);
                                callback && callback(err);
                            });
                        });
                        return;
                    } else {
                        // blinds
                        if (typeof obj.common.min !== 'undefined') {
                            value = obj.common.min;
                        } else {
                            value = 0;
                        }
                    }
                }
            } else if (obj.common.role === 'level.color.rgb') {
                if (value) {
                    if (byON === 'stored' && valuesON[id]) {
                        adapter.log.debug(`[ALEXA] Use stored ON value for "${id}": ${valuesON[id]}`);
                        value = valuesON[id];
                    } else {
                        value = '#FFFFFF';
                    }
                } else {
                    if (byON === 'stored') {
                        // remember last state
                        adapter.getForeignState(id, function (err, state) {
                            err && adapter.log.error(`[ALEXA] Cannot get state: ${err}`);

                            value = '#000000';
                            // do not remember the minimum/off value
                            if (state && state.val !== value) valuesON[id] = state.val;

                            adapter.log.debug(`[ALEXA] OFF Stored: Set "${id}" to ${value} and store old value "${id}"`);

                            adapter.setForeignState(id, value, err => {
                                err && adapter.log.error(`[ALEXA] Cannot switch device: ${err}`);
                                callback && callback(err);
                            });
                        });
                        return;
                    } else {
                        value = '#000000';
                    }
                }
            }
            adapter.log.debug(`[ALEXA] Set "${id}" to ${value}`);

            if (writeStates) {
                adapter.setState('smart.lastObjectID', id,    true);
            }

            adapter.setForeignState(id, value, err => {
                err && adapter.log.error(`[ALEXA] Cannot switch device: ${err}`);
                callback && callback(err);
            });
        });
    }

    function controlPercent(dimmer, id, value, writeStates, callback) {
        adapter.getForeignObject(id, function (err, obj) {
            if (!obj || obj.type !== 'state') {
                err && adapter.log.error(`[ALEXA] Cannot control non state: ${id} ${obj ? obj.type : 'no object'}`);
                return callback && callback();
            }

            if (dimmer && dimmer !== id) {
                adapter.log.debug(`[ALEXA] Won't control ${id} as we have a dimmer available for this channel.`);
                return callback && callback();
            }

            let res = Actions.getActions(obj);
            if (!res || !res.actions.includes('setPercentage')) {
                adapter.log.debug(`[ALEXA] ${id} is no valid datapoint to set the percentage.`);
                return callback && callback();
            }

            adapter.log.debug(`[ALEXA] Controlling ${id} .`);

            let max = 100;
            let min = 0;

            if (typeof obj.common.max !== 'undefined') {
                max = parseFloat(obj.common.max);
            }
            if (typeof obj.common.min !== 'undefined') {
                min = parseFloat(obj.common.min);
            }

            value = (value / 100) * (max - min) + min;

            if (obj.common.type === 'boolean') {
                value = (value >= adapter.config.deviceOffLevel);
            } else if (adapter.config.deviceOffLevel && value >= adapter.config.deviceOffLevel && (!obj.common.role || !obj.common.role.includes('blind'))) {
                valuesON[id] = value;
                adapter.log.debug(`[ALEXA] Remember ON value for  "${id}": ${value}`);
            }

            if (writeStates) {
                adapter.setState('smart.lastObjectID', id, true);
            }

            adapter.setForeignState(id, value, err => {
                err && adapter.log.error(`[ALEXA] Cannot switch device: ${err}`);
                callback && callback();
            });
        });
    }

    function controlDelta(dimmer, id, delta, writeStates, callback) {
        adapter.getForeignObject(id, function (err, obj) {
            if (!obj || obj.type !== 'state') {
                err && adapter.log.error(`[ALEXA] Cannot control non state: ${id} ${obj ? obj.type : 'no object'}`);
                return callback && callback();
            }

            if (obj.common.type === 'boolean') {
                adapter.log.debug(`[ALEXA] Object ${id} does not support Deltas.`);
                return callback && callback();
            }

            if (dimmer && dimmer !== id) {
                adapter.log.debug(`[ALEXA] Won't control ${id} as we have a dimmer available for this channel.`);
                return callback && callback();
            }

            let res = Actions.getActions(obj);
            if (!res || (!res.actions.includes('incrementPercentage') && !res.actions.includes('decrementPercentage'))) {
                adapter.log.debug(`[ALEXA] ${id} is no valid datapoint to increment or decrement the percentage.`);
                return callback && callback();
            }

            adapter.log.debug(`[ALEXA] Controlling delta ${id}`);

            adapter.getForeignState(id, function (err, state) {
                let value = state ? (state.val || 0) : 0;
                let max = 100;
                let min = 0;
                if (typeof obj.common.max !== 'undefined') {
                    max = parseFloat(obj.common.max);
                }
                if (typeof obj.common.min !== 'undefined') {
                    min = parseFloat(obj.common.min);
                }

                // Absolute value => percent => add delta
                value = (value - min) / (max - min) * 100 + delta;
                if (value > 100) value = 100;
                if (value < 0)   value = 0;
                // percent => absolute value
                value = (value / 100) * (max - min) + min;

                if (adapter.config.deviceOffLevel && value >= adapter.config.deviceOffLevel) {
                    adapter.log.debug(`[ALEXA] Remember ON value for  "${id}": ${value}`);
                    valuesON[id] = value;
                }

                if (writeStates) {
                    adapter.setState('smart.lastObjectID', id, true);
                }

                adapter.setForeignState(id, value, err => {
                    err && adapter.log.error(`[ALEXA] Cannot set device: ${err}`);
                    callback && callback();
                });
            });
        });
    }

    function controlTemperature(id, value, writeStates, callback) {
        //{
        //    "header" : {
        //    "namespace" : "Alexa.ConnectedHome.Control",
        //        "name" : "SetTargetTemperatureConfirmation",
        //        "payloadVersion" : "2",
        //        "messageId" : "cc36e80c-6357-41e0-9dd4-b76cb3a394e3"
        //    },
        //    "payload" : {
        //        "targetTemperature" : {
        //            "value" : 25.0
        //        },
        //        "temperatureMode" : {
        //            "value" : "AUTO"
        //        },
        //        "previousState" : {
        //            "targetTemperature" : {
        //                "value" : 21.0
        //            },
        //            "mode" : {
        //                "value" : "AUTO"
        //            }
        //        }
        //    }
        //}

        adapter.getForeignObject(id, (err, obj) => {
            if (!obj || obj.type !== 'state') {
                err && adapter.log.error(`[ALEXA] Cannot control non state: ${id} ${obj ? obj.type : 'no object'}`);
                return callback && callback();
            }

            let res = Actions.getActions(obj);
			if (!res || !res.actions.includes('setTargetTemperature')) {
                adapter.log.debug(`[ALEXA] ${id} is no valid datapoint to set the target temperature.`);
                return callback && callback();
            }

            value = parseFloat(value);
            let max;
            let min;
            if (typeof obj.common.max !== 'undefined') {
                max = parseFloat(obj.common.max);
            }
            if (typeof obj.common.min !== 'undefined') {
                min = parseFloat(obj.common.min);
            }

            if (min !== undefined && value < min) {
                value = min;
            }
            if (max !== undefined && value > max) {
                value = max;
            }

            if (obj.common.type === 'boolean') {
                value = !!value;
            }

            adapter.getForeignState(id, (err, state) => {
                err && adapter.log.error(`[ALEXA] Cannot read device: ${err}`);

                if (writeStates) {
                    adapter.setState('smart.lastObjectID', id, true);
                }

                adapter.setForeignState(id, value, err => {
                    err && adapter.log.error(`[ALEXA] Cannot switch device: ${err}`);
                    let response = {
                        payload: {
                            targetTemperature: {
                                value: value
                            },
                            temperatureMode: {
                                value: 'AUTO'
                            },
                            previousState: {
                                targetTemperature: {
                                    value: state ? parseFloat(state.val) || 0 : 0
                                },
                                mode: {
                                    value: 'AUTO'
                                }
                            }
                        }
                    };

                    callback && callback(null, response);
                });
            });
        });
    }

    function getTemperature(id, writeStates, callback) {
        adapter.getForeignObject(id, function (err, obj) {
            if (!obj || obj.type !== 'state') {
                err && adapter.log.error(`[ALEXA] Cannot control non state: ${id} ${obj ? obj.type : 'no object'}`);
                return callback && callback();
            }

			let res = Actions.getActions(obj);
			if (!res || !res.actions.includes('getTemperatureReading')) {
                adapter.log.debug(`[ALEXA] ${id} is no valid datapoint to get the actual temperature.`);
                return callback && callback();
            }

            adapter.getForeignState(id, function (err, state) {
                err && adapter.log.error(`[ALEXA] Cannot read device: ${err}`);

                if (writeStates) {
                    adapter.setState('smart.lastObjectID', id, true);
                }

                callback && callback(null, state ? state.val : null, state ? state.ts : null);
            });
        });
    }

    function getTargetTemperature(id, writeStates, callback) {
        adapter.getForeignObject(id, function (err, obj) {
            if (!obj || obj.type !== 'state') {
                err && adapter.log.error(`[ALEXA] Cannot control non state: ${id} ${obj ? obj.type : 'no object'}`);
                return callback && callback();
            }

			let res = Actions.getActions(obj);
			if (!res || !res.actions.includes('getTargetTemperature')) {
                adapter.log.debug(`[ALEXA] ${id} is no valid datapoint to get the target temperature.`);
                return callback && callback();
            }

            adapter.getForeignState(id, function (err, state) {
                err && adapter.log.error(`[ALEXA] Cannot read device: ${err}`);

                if (writeStates) {
                    adapter.setState('smart.lastObjectID', id, true);
                }

                callback && callback(null, state ? state.val : null, state ? state.ts : null);
            });
        });
    }

    function controlTemperatureDelta(id, delta, writeStates, callback) {
        adapter.getForeignObject(id, function (err, obj) {
            if (!obj || obj.type !== 'state') {
                err && adapter.log.error(`[ALEXA] Cannot control non state: ${id} ${obj ? obj.type : 'no object'}`);
                return callback && callback(err || `Invalid object: ${id}`);
            }

            let res = Actions.getActions(obj);
			if (!res || res.actions.includes('setTargetTemperature')) {
                adapter.log.debug(`[ALEXA] ${id} is no valid datapoint to set the target temperature.`);
                return callback && callback();
            }

            adapter.getForeignState(id, function (err, state) {
                err && adapter.log.error(`[ALEXA] Cannot read device: ${err}`);

                let value = state ? state.val || 0 : 0;
                let max;
                let min;
                if (typeof obj.common.max !== 'undefined') {
                    max = parseFloat(obj.common.max);
                }
                if (typeof obj.common.min !== 'undefined') {
                    min = parseFloat(obj.common.min);
                }

                // Absolute value => percent => add delta
                value = value + delta;
                if (max !== undefined && value > max) {
                    value = max;
                }
                if (min !== undefined && value < min) {
                    value = min;
                }

                if (obj.common.type === 'boolean') {
                    value = !!value;
                }

                if (writeStates) {
                    adapter.setState('smart.lastObjectID', id, true);
                }

                adapter.setForeignState(id, value, err => {
                    err && adapter.log.error(`[ALEXA] Cannot switch device: ${err}`);
                    let response = {
                        payload: {
                            targetTemperature: {
                                value: value
                            },
                            /*temperatureMode: {
                             value: 'AUTO'
                             },*/
                            previousState: {
                                targetTemperature: {
                                    value: state ? parseFloat(state.val) || 0 : 0
                                },
                                mode: {
                                    value: 'AUTO'
                                }
                            }
                        }
                    };

                    callback && callback(err, response);
                });
            });
        });
    }

    function controlLock(id, writeStates, callback) {
        adapter.getForeignObject(id, function (err, obj) {
            if (!obj || obj.type !== 'state') {
                err && adapter.log.error(`[ALEXA] Cannot control non state: ${id} ${obj ? obj.type : 'no object'}`);
                return callback && callback();
            }
            adapter.log.debug('[ALEXA] Lock "' + id + '"');

            if (writeStates) {
                adapter.setState('smart.lastObjectID', id, true);
            }
            if (obj.native.LOCK_VALUE === undefined && obj.native.CONTROL_VALUE === undefined ) {
                adapter.log.warn(`[ALEXA] Cannot choose value for lock: Please define in "${id}" the "native.LOCK_VALUE" or "native.CONTROL_VALUE"  with locking value`);
                callback && callback('Cannot choose value for lock');
            } else {

                adapter.setForeignState(id,
                    obj.native.CONTROL_VALUE === undefined ? obj.native.LOCK_VALUE : obj.native.CONTROL_VALUE,
                    err => {
                    err && adapter.log.error(`[ALEXA] Cannot switch device: ${err}`);
                    callback && callback();
                });
            }
        });
    }

    function getLock(id, writeStates, callback) {
        adapter.getForeignObject(id, function (err, obj) {
            if (!obj || obj.type !== 'state') {
                err && adapter.log.error(`[ALEXA] Cannot control non state: ${id} ${obj ? obj.type : 'no object'}`);
                return callback && callback();
            }
            adapter.log.debug('[ALEXA] Get lock state "' + id + '"');

            if (writeStates) {
                adapter.setState('smart.lastObjectID', id, true);
            }
            if (obj.native.LOCK_VALUE === undefined) {
                adapter.log.warn(`[ALEXA] Cannot choose value for lock: Please define in "${id}" the "native.LOCK_VALUE" with locking value`);
                callback && callback('Cannot choose value for lock');
            } else {
                adapter.getForeignState(id, function (err, state) {
                    if (err || !state) adapter.log.error(`[ALEXA] Cannot switch device: ${err}`);
                    if (callback) {
                        if (obj.native.LOCK_VALUE === 'true'  || obj.native.LOCK_VALUE === '1' || obj.native.LOCK_VALUE === 1 || obj.native.LOCK_VALUE === 'locked')   obj.native.LOCK_VALUE = true;
                        if (obj.native.LOCK_VALUE === 'false' || obj.native.LOCK_VALUE === '0' || obj.native.LOCK_VALUE === 0 || obj.native.LOCK_VALUE === 'unlocked') obj.native.LOCK_VALUE = false;
                        if (state.val === 'true'  || state.val === '1' || state.val === 1 || state.val === 'locked')   state.val = true;
                        if (state.val === 'false' || state.val === '0' || state.val === 0 || state.val === 'unlocked') state.val = false;

                        callback(err, state.val === obj.native.LOCK_VALUE, state.lc || state.ts);
                    }
                });
            }
        });
    }

    // expected hue range: [0, 1)
    // expected saturation range: [0, 1]
    // expected lightness range: [0, 1]
    // Based on http://axonflux.com/handy-rgb-to-hsl-and-rgb-to-hsv-color-model-c
    function hsvToRgb(h, s, v) {
        let r;
        let g;
        let b;
        let i = Math.floor(h * 6);
        let f = h * 6 - i;
        let p = v * (1 - s);
        let q = v * (1 - f * s);
        let t = v * (1 - (1 - f) * s);

        switch(i % 6){
            case 0:
                r = v;
                g = t;
                b = p;
                break;

            case 1:
                r = q;
                g = v;
                b = p;
                break;

            case 2:
                r = p;
                g = v;
                b = t;
                break;

            case 3:
                r = p;
                g = q;
                b = v;
                break;

            case 4:
                r = t;
                g = p;
                b = v;
                break;

            case 5:
                r = v;
                g = p;
                b = q;
                break;
        }
        return '#' + padding(Math.round(r * 255)) + padding(Math.round(g * 255)) + padding(Math.round(b * 255));
    }

    function controlColorRgb(id, color, writeStates, callback) {
        adapter.log.debug(`[ALEXA] ID: ${id} Color: ${JSON.stringify(color)}`);
        // "color": {
        //     "hue": 0.0,
        //     "saturation": 1.0000,
        //     "brightness": 1.0000
        // }
        adapter.getForeignObject(id, function (err, obj) {
            if (!obj || obj.type !== 'state') {
                err && adapter.log.error(`[ALEXA] Cannot control non state: ${id} ${obj ? obj.type : 'no object'}`);
                return callback && callback();
            }
            let rgb = hsvToRgb(color.hue/360, color.saturation, color.brightness);

            adapter.setForeignState(id, rgb, err => {
                err && adapter.log.error(`[ALEXA] Cannot read device: ${err}`);

                if (writeStates) {
                    adapter.setState('smart.lastObjectID', id, true);
                }
                callback && callback(err);
            });
        });
    }

    function controlColorHue(ids, idh, idb, color, writeStates, callback) {
        // "color": {
        //     "hue": 0.0,
        //     "saturation": 1.0000,
        //     "brightness": 1.0000
        // }
        adapter.getForeignObject(idh, function (err, obj) {
            if (!obj || obj.type !== 'state') {
                err && adapter.log.error(`[ALEXA] Cannot control non state: ${idh} ${obj ? obj.type : 'no object'}`);
                return callback && callback();
            }

            if (obj.common && obj.common.min !== undefined && obj.common.max !== undefined) {
                color.hue = Math.round((obj.common.max - obj.common.min) * (color.hue / 360) + obj.common.min);
            }
            adapter.setForeignState(idh, color.hue, err => {
                err && adapter.log.error(`[ALEXA] Cannot read device: ${err}`);

                if (writeStates) {
                    adapter.setState('smart.lastObjectID', idh, true);
                }
                if (!ids) {
                    err && adapter.log.info('Unable to control saturation. No Saturation Endpoint in Smart Device.');
                    return callback && callback();
                }
                adapter.getForeignObject(ids, function (err, obj) {
                    if (obj && obj.common && obj.common.min !== undefined && obj.common.max !== undefined) {
                        color.saturation = (obj.common.max - obj.common.min) * color.saturation + obj.common.min;
                    } else {
                        color.saturation *= 100;
                    }

                    adapter.setForeignState(ids, color.saturation, err => {
                        err && adapter.log.error('[ALEXA] Cannot read device: ' + err);

                        if (!idb){
                            err && adapter.log.info('Unable to control brightness. No Dimmer Endpoint in Smart Device.');
                            return callback && callback();
                        }
                        adapter.getForeignObject(idb, function (err, obj) {
                            if (obj && obj.common && obj.common.ignoreAlexaColor === 'true') {
                                return callback && callback(err);
                            }

                            if (obj && obj.common && obj.common.min !== undefined && obj.common.max !== undefined) {
                                color.brightness = (obj.common.max - obj.common.min) * color.brightness + obj.common.min;
                            } else {
                                color.brightness *= 100;
                            }

                            adapter.setForeignState(idb, color.brightness, err => {
                                err && adapter.log.error(`[ALEXA] Cannot read device: ${err}`);
                                callback && callback(err);
                            });
                        });
                    });
                });
            });
        });
    }

    function controlColorTemperature(temperature, id, value, writeStates, callback) {
        adapter.getForeignObject(id, function (err, obj) {
            if (!obj || obj.type !== 'state') {
                err && adapter.log.error(`[ALEXA] Cannot control non state: ${id} ${obj ? obj.type : 'no object'}`);
                return callback && callback();
            }


            if (!temperature || (temperature && temperature !== id)) {
                adapter.log.debug(`[ALEXA] Won't control ${id} as not a color temperature.`);
                return callback && callback();
            }

            const unit = obj.common.unit;
            let friendlyUnit;
            if (unit == null) {
                // default to mired
                friendlyUnit = 'mired';
            } else if (unit.match('K')) {
                friendlyUnit = 'kelvin';
            } else if (unit === '%') {
                friendlyUnit = 'percent';
            }

            // Alexa reports a value in Kelvin between 1000 and 10000
            // By default we limit ourselves to the predefined values:
            //   warm, warm white 	        2200
            //   incandescent, soft white 	2700
            //   white 	                    4000
            //   daylight, daylight white 	5500
            //   cool, cool white 	        7000
            let minK = 2200;
            let maxK = 7000;

            if (friendlyUnit === 'kelvin') {
                if (obj.common.min != null) minK = parseFloat(obj.common.min);
                if (obj.common.max != null) maxK = parseFloat(obj.common.max);
                value = Math.max(minK, Math.min(value, maxK));
            } else { // % or mired
                // for non-kelvin scales we have to re-calculate the value
                // The internal representation is in mired
                value = 1e6 / value;

                let minM = Math.round(1e6 / maxK);
                let maxM = Math.round(1e6 / minK);
                if (friendlyUnit === 'mired') {
                    // respect the defined min/max
                    if (obj.common.min != null) minM = parseFloat(obj.common.min);
                    if (obj.common.max != null) maxM = parseFloat(obj.common.max);
                } else if (friendlyUnit === 'percent') {
                    // scale the value from minM (0%) to maxM (100%)
                    value = (value - minM) / (maxM - minM) * 100;
                    // set the limits to 0..100
                    minM = 0;
                    maxM = 100;
                }
                value = Math.round(value);
                value = Math.max(minM, Math.min(value, maxM));
            }

            adapter.log.debug(`[ALEXA] Controlling: ${id} setting to ${value}`);

            adapter.setForeignState(id, value, err => {
                err && adapter.log.error(`[ALEXA] Cannot switch device: ${err}`);
                callback && callback();
            });
        });
    }

    function controlColorTemperatureDelta(temperature, id, delta, writeStates, callback) {
        adapter.getForeignObject(id, function (err, obj) {
            if (!obj || obj.type !== 'state') {
                err && adapter.log.error(`[ALEXA] Cannot control non state: ${id} ${obj ? obj.type : 'no object'}`);
                return callback && callback('Not controlling');
            }

            if (!temperature || (temperature && temperature !== id)) {
                adapter.log.debug(`[ALEXA] Won't control ${id} as not a color temperature.`);
                return callback && callback('Not controlling');
            }

            const unit = obj.common.unit;
            let friendlyUnit;
            if (unit == null) {
                // default to mired
                friendlyUnit = 'mired';
            } else if (unit.match('K')) {
                friendlyUnit = 'kelvin';
            } else if (unit === '%') {
                friendlyUnit = 'percent';
            }

            // see controlColorTemperature for a description
            const minK = 2200;
            const maxK = 7000;
            let minValue = minK;
            let maxValue = maxK;

            switch (friendlyUnit) {
                case 'kelvin': {
                    delta = delta * -1;
                    if (obj.common.min != null) minValue = parseFloat(obj.common.min);
                    if (obj.common.max != null) maxValue = parseFloat(obj.common.max);
                    break;
                }
                case 'mired': {
                    minValue = Math.round(1e6 / maxValue);
                    maxValue = Math.round(1e6 / minValue);
                    if (obj.common.min != null) minValue = parseFloat(obj.common.min);
                    if (obj.common.max != null) maxValue = parseFloat(obj.common.max);
                    break;
                }
                case 'percent': {
                    minValue = 0;
                    maxValue = 100;
                }
            }

            adapter.getForeignState(id, function (err, state) {
                let value = state ? state.val || 0 : 0;

                // percentage of the state's range that is added/subtracted from the current value
                const deltaFactor = 0.25;
                value = Math.round(value + delta * deltaFactor * (maxValue - minValue));
                value = Math.max(minValue, Math.min(value, maxValue));

                adapter.log.debug(`[ALEXA] Controlling: ${id} setting to ${value}`);

                adapter.setForeignState(id, value, err => {
                    err && adapter.log.error(`[ALEXA] Cannot switch device: ${err}`);
                    if (callback) {
                        // convert value back to Kelvin for reporting
                        if (friendlyUnit === 'percent') {
                            // back to mired
                            const minM = 1e6 / maxK;
                            const maxM = 1e6 / minK;
                            value = minM + value / 100 * (maxM - minM);
                        }
                        if (friendlyUnit === 'mired' || friendlyUnit === 'percent') {
                            // back to Kelvin
                            value = Math.round(1e6 / value);
                        }
                        callback(null, value);
                    }
                });
            });
        });
    }

    function findRoleInChannel(channel, role) {
        for (let i = 0; i < channel.length; i++) {
            let dev = channel[i];
            if (dev.role === role){
                return dev.id;
            }
        }
        return null;
    }

    this.getDebug = function (cb) {
        let smartDevicesCopy = JSON.parse(JSON.stringify(smartDevices));
        for (let j = 0; j < smartDevicesCopy.length; j++) {
            if (!smartDevicesCopy[j].additionalApplianceDetails) continue;
            if (smartDevicesCopy[j].additionalApplianceDetails.names        !== undefined) delete smartDevicesCopy[j].additionalApplianceDetails.names;
            if (smartDevicesCopy[j].additionalApplianceDetails.name         !== undefined) delete smartDevicesCopy[j].additionalApplianceDetails.name;
            if (smartDevicesCopy[j].additionalApplianceDetails.byON         !== undefined) delete smartDevicesCopy[j].additionalApplianceDetails.byON;
            if (smartDevicesCopy[j].additionalApplianceDetails.byONs        !== undefined) delete smartDevicesCopy[j].additionalApplianceDetails.byONs;
            if (smartDevicesCopy[j].additionalApplianceDetails.nameModified !== undefined) delete smartDevicesCopy[j].additionalApplianceDetails.nameModified;
            if (smartDevicesCopy[j].additionalApplianceDetails.room         !== undefined) delete smartDevicesCopy[j].additionalApplianceDetails.room;
            if (smartDevicesCopy[j].additionalApplianceDetails.func         !== undefined) delete smartDevicesCopy[j].additionalApplianceDetails.func;
            if (smartDevicesCopy[j].additionalApplianceDetails.smartType    !== undefined) delete smartDevicesCopy[j].additionalApplianceDetails.smartType;
            if (smartDevicesCopy[j].additionalApplianceDetails.smartTypes   !== undefined) delete smartDevicesCopy[j].additionalApplianceDetails.smartTypes;
            if (smartDevicesCopy[j].additionalApplianceDetails.channels     !== undefined) delete smartDevicesCopy[j].additionalApplianceDetails.channels;
        }

        cb({
            header: {},
            payload: {
                discoveredAppliances: smartDevicesCopy
            }
        });
    };

    this.process = function (request, isEnabled, callback) {
        let channels = {};
        let count = 0;
        let device;

        if (!isEnabled) {
            request.header.name = 'NotSupportedInCurrentModeError';
            callback({
                header: request.header,
                payload: {}
            });
            request = null;
            return;
        }

        if (request && request.payload && request.payload.appliance && request.payload.appliance.additionalApplianceDetails) {
            let details = null;
            for (let i = 0; i < smartDevices.length; i++) {
                if (smartDevices[i].applianceId === request.payload.appliance.applianceId) {
                    device = smartDevices[i];
                    details = smartDevices[i].additionalApplianceDetails;
                }
            }

            if (adapter.common.loglevel === 'debug') {
                adapter.log.debug('[ALEXA] Found following devices to control: ' + JSON.stringify(details));
            }

            if (details) {
                if (details.group) {
                    channels = details.channels;
                } else {
                    let id = details.id;
                    let role = details.role;
                    let _parts = id.split('.');
                    _parts.pop();
                    let channel = _parts.join('.');
                    channels[channel] = [{id: id, role: role}];
                }
            }

            for (const chan in channels) {
                if (channels.hasOwnProperty(chan)) {
                    count += channels[chan].length;
                }
            }
        }
        adapter.log.debug('[ALEXA] New Request: ' + request.header.name);

        switch (request.header.name) {
            case 'DiscoverAppliancesRequest': {
                    //{
                    //      "header": {
                    //          "messageId": "6d6d6e14-8aee-473e-8c24-0d31ff9c17a2",
                    //          "name": "DiscoverAppliancesRequest",
                    //          "namespace": "Alexa.ConnectedHome.Discovery",
                    //          "payloadVersion": "2"
                    //      },
                    //      "payload": {
                    //          "accessToken": "*OAuth Token here*"
                    //      }
                    //}
                    request.header.name = 'DiscoverAppliancesResponse';
                    //if (smartDevices.length > 100) smartDevices.splice(50, smartDevices.length - 50);
                    //console.log(JSON.stringify(smartDevices));
                    let smartDevicesCopy = JSON.parse(JSON.stringify(smartDevices));
                    for (let j = 0; j < smartDevicesCopy.length; j++) {
                        if (!smartDevicesCopy[j].additionalApplianceDetails) continue;
                        if (smartDevicesCopy[j].additionalApplianceDetails.names        !== undefined) delete smartDevicesCopy[j].additionalApplianceDetails.names;
                        if (smartDevicesCopy[j].additionalApplianceDetails.name         !== undefined) delete smartDevicesCopy[j].additionalApplianceDetails.name;
                        if (smartDevicesCopy[j].additionalApplianceDetails.byON         !== undefined) delete smartDevicesCopy[j].additionalApplianceDetails.byON;
                        if (smartDevicesCopy[j].additionalApplianceDetails.byONs        !== undefined) delete smartDevicesCopy[j].additionalApplianceDetails.byONs;
                        if (smartDevicesCopy[j].additionalApplianceDetails.nameModified !== undefined) delete smartDevicesCopy[j].additionalApplianceDetails.nameModified;
                        if (smartDevicesCopy[j].additionalApplianceDetails.room         !== undefined) delete smartDevicesCopy[j].additionalApplianceDetails.room;
                        if (smartDevicesCopy[j].additionalApplianceDetails.func         !== undefined) delete smartDevicesCopy[j].additionalApplianceDetails.func;
                        if (smartDevicesCopy[j].additionalApplianceDetails.smartType    !== undefined) delete smartDevicesCopy[j].additionalApplianceDetails.smartType;
                        if (smartDevicesCopy[j].additionalApplianceDetails.smartTypes   !== undefined) delete smartDevicesCopy[j].additionalApplianceDetails.smartTypes;
                        if (smartDevicesCopy[j].additionalApplianceDetails.channels     !== undefined) delete smartDevicesCopy[j].additionalApplianceDetails.channels;
                    }

                    let response = {
                        header: request.header,
                        payload: {
                            discoveredAppliances: smartDevicesCopy/*[
                             {
                             "applianceId":          "hm-rpc",
                             "manufacturerName":     "ioBroker",
                             "modelName":            "Bad.Hauptlicht.Aktor.STATE",
                             "version":              "1",
                             "friendlyName":         "Licht im Bad",
                             "friendlyDescription":  "Bad Hauptlicht Aktor STATE",
                             "isReachable":          true,
                             "actions": [
                             "incrementTargetTemperature",
                             "decrementTargetTemperature",
                             "setTargetTemperature"
                             ],
                             "additionalApplianceDetails": {
                             id: 'hm-rpc.1.1'
                             }
                             },{
                             "applianceId":          "hm-rpc-1",
                             "manufacturerName":     "ioBroker",
                             "modelName":            "Bad.Hauptlicht.Aktor.STATE",
                             "version":              "1",
                             "friendlyName":         "Licht im Bad",
                             "friendlyDescription":  "Bad Hauptlicht Aktor STATE",
                             "isReachable":          true,
                             "actions": [
                             "incrementTargetTemperature",
                             "decrementTargetTemperature",
                             "setTargetTemperature"
                             ],
                             "additionalApplianceDetails": {}
                             },
                             {
                             "applianceId":      "uniqueThermostatDeviceId",
                             "manufacturerName": "yourManufacturerName",
                             "modelName":        "fancyThermostat",
                             "version":          "your software version number here.",
                             "friendlyName":     "Bedroom Thermostat",
                             "friendlyDescription": "descriptionThatIsShownToCustomer",
                             "isReachable":      true,
                             "actions": [
                             "incrementTargetTemperature",
                             "decrementTargetTemperature",
                             "setTargetTemperature"
                             ],
                             "additionalApplianceDetails": {
                             }
                             },
                             {
                             "actions": [
                             "incrementPercentage",
                             "decrementPercentage",
                             "setPercentage",
                             "turnOn",
                             "turnOff"
                             ],
                             "additionalApplianceDetails": {},
                             "applianceId":          "uniqueLightDeviceId",
                             "friendlyDescription":  "descriptionThatIsShownToCustomer",
                             "friendlyName":         "Living Room",
                             "isReachable":          true,
                             "manufacturerName":      "yourManufacturerName",
                             "modelName":            "fancyLight",
                             "version":              "your software version number here."
                             }
                             ]*/
                        }
                    };

                    adapter.log.debug(`[ALEXA] Response size: ${Math.round(JSON.stringify(response).length / 1024)}kb`);
                    //adapter.log.debug('[ALEXA] Response: ' + JSON.stringify(response));
                    callback(response);
                    //console.log(JSON.stringify(response, null, 2));
                    request = null;
                    smartDevicesCopy = null;
                }
                break;

            case 'TurnOnRequest': {
                    //  {
                    //      "header": {
                    //          "messageId": "01ebf625-0b89-4c4d-b3aa-32340e894688",
                    //          "name": "TurnOnRequest",
                    //          "namespace": "Alexa.ConnectedHome.Control",
                    //          "payloadVersion": "2"
                    //      },
                    //      "payload": {
                    //          "accessToken": "[OAuth Token here]",
                    //          "appliance": {
                    //              "additionalApplianceDetails": {},
                    //              "applianceId": "[Device ID for Ceiling Fan]"
                    //          }
                    //      }
                    // }
                    adapter.log.debug(`[ALEXA] ALEXA ON: ${request.payload.appliance.applianceId}`);

                    for (let channel in channels) {
                        if (!channels.hasOwnProperty(channel)) {
                            continue;
                        }
                        let toggle = findRoleInChannel(channels[channel], 'level.dimmer');
                        if (toggle) {
                            let byon = (device.additionalApplianceDetails.group) ?
                                            device.additionalApplianceDetails.byONs[toggle] :
                                            device.additionalApplianceDetails.byON;
                            if (!byon || byon === '-') {
                                toggle = null;
                            }
                        }

                        toggle = toggle || findRoleInChannel(channels[channel], 'switch');

                        for (let i = 0; i < channels[channel].length; i++) {
                            let id = channels[channel][i].id;
                            adapter.log.debug('[ALEXA] Controlling: ' + id);
                            controlOnOff(toggle, id, true, Object.keys(channels).length === 1, err => {
                                err && adapter.log.error(`[ALEXA] Cannot controlOnOff: ${err}`);
                                if (!--count) {
                                    request.header.name = 'TurnOnConfirmation';

                                    callback({
                                        header: request.header,
                                        payload: {}
                                    });

                                    request = null;
                                }
                            });
                        }
                    }

                    writeResponse(request.payload.appliance.applianceId, 'ONOFF', true);
                }
                break;

            case 'TurnOffRequest': {
                    //  {
                    //      "header": {
                    //          "messageId": "01ebf625-0b89-4c4d-b3aa-32340e894688",
                    //          "name": "TurnOffRequest",
                    //          "namespace": "Alexa.ConnectedHome.Control",
                    //          "payloadVersion": "2"
                    //      },
                    //      "payload": {
                    //          "accessToken": "[OAuth Token here]",
                    //          "appliance": {
                    //              "additionalApplianceDetails": {},
                    //              "applianceId": "[Device ID for Ceiling Fan]"
                    //          }
                    //      }
                    // }
                    adapter.log.debug('[ALEXA] ALEXA OFF: ' + request.payload.appliance.applianceId);

                    for (let channel in channels) {
                        if (!channels.hasOwnProperty(channel)) {
                            continue;
                        }
                        let toggle = findRoleInChannel(channels[channel], 'level.dimmer');
                        if (toggle) {
                            let byon = (device.additionalApplianceDetails.group) ?
                                            device.additionalApplianceDetails.byONs[toggle] :
                                            device.additionalApplianceDetails.byON;
                            if (!byon || byon === '-') {
                                toggle = null;
                            }
                        }

                        toggle = toggle || findRoleInChannel(channels[channel], 'switch');

                        adapter.log.debug(toggle);
                        for (let i = 0; i < channels[channel].length; i++) {
                            let id = channels[channel][i].id;
                            adapter.log.debug('[ALEXA] Controlling off: ' + id);
                            controlOnOff(toggle, id, false, Object.keys(channels).length === 1, err => {
                                err && adapter.log.error(`[ALEXA] Cannot controlOnOff: ${err}`);
                                if (!--count) {
                                    request.header.name = 'TurnOffConfirmation';

                                    callback({
                                        header: request.header,
                                        payload: {}
                                    });
                                    request = null;
                                }
                            });
                        }
                    }
                    writeResponse(request.payload.appliance.applianceId, 'ONOFF', false);
                }
                break;

            case 'SetLockStateRequest': {
                    //  {
                    //      "header": {
                    //          "messageId": "01ebf625-0b89-4c4d-b3aa-32340e894688",
                    //          "name": "TurnOnRequest",
                    //          "namespace": "Alexa.ConnectedHome.Control",
                    //          "payloadVersion": "2"
                    //      },
                    //      "payload": {
                    //          "accessToken": "[OAuth Token here]",
                    //          "appliance": {
                    //              "additionalApplianceDetails": {},
                    //              "applianceId": "[Device ID for Ceiling Fan]"
                    //          }
                    //      }
                    // }
                    adapter.log.debug('[ALEXA] ALEXA LOCK: ' + request.payload.appliance.applianceId);
                    for (let channel in channels) {
                        if (!channels.hasOwnProperty(channel)) {
                            continue;
                        }
                        for (let i = 0; i < channels[channel].length; i++) {
                            let id = channels[channel][i].id;
                            adapter.log.debug('[ALEXA] Controlling lock: ' + id);
                            controlLock(id, Object.keys(channels).length === 1, err => {
                                err && adapter.log.error(`[ALEXA] Cannot controlLock: ${err}`);
                                if (!--count) {
                                    request.header.name = 'SetLockStateConfirmation';

                                    if (err) {
                                        callback({
                                            header: request.header,
                                            payload: {
                                                lockState: 'UNLOCKED'
                                            }
                                        });
                                    } else {
                                        callback({
                                            header: request.header,
                                            payload: {
                                                lockState: 'LOCKED'
                                            }
                                        });
                                    }

                                    request = null;
                                }
                            });
                        }
                    }

                    writeResponse(request.payload.appliance.applianceId, 'ONOFF', true);
                }
                break;

            case 'GetLockStateRequest': {
                    //  {
                    //      "header": {
                    //          "messageId": "01ebf625-0b89-4c4d-b3aa-32340e894688",
                    //          "name": "TurnOnRequest",
                    //          "namespace": "Alexa.ConnectedHome.Control",
                    //          "payloadVersion": "2"
                    //      },
                    //      "payload": {
                    //          "accessToken": "[OAuth Token here]",
                    //          "appliance": {
                    //              "additionalApplianceDetails": {},
                    //              "applianceId": "[Device ID for Ceiling Fan]"
                    //          }
                    //      }
                    // }
                    adapter.log.debug('[ALEXA] ALEXA GetLOCK: ' + request.payload.appliance.applianceId);
                    let result = null;
                    for (let channel in channels) {
                        if (!channels.hasOwnProperty(channel)) {
                            continue;
                        }
                        for (let i = 0; i < channels[channel].length; i++) {
                            let id = channels[channel][i].id;
                            adapter.log.debug(`[ALEXA] Controlling lock: ${id}`);
                            getLock(id, Object.keys(channels).length === 1, (err, value, ts) => {
                                err && adapter.log.error(`[ALEXA] Cannot getLock: ${err}`);
                                if (result === null || value === false) {
                                    adapter.log.debug(`[ALEXA] Settings result: ${value}`);
                                    result = value;
                                }

                                if (!--count) {
                                    request.header.name = 'GetLockStateResponse';

                                    if (err) {
                                        callback({
                                            header: request.header,
                                            payload: {
                                                lockState: 'UNLOCKED'
                                            }
                                        });
                                    } else {
                                        callback({
                                            header: request.header,
                                            payload: {
                                                lockState: value ? 'LOCKED' : 'UNLOCKED',
                                                applianceResponseTimestamp: ts ? new Date(ts).toISOString() : new Date().toISOString()
                                            }
                                        });
                                    }

                                    request = null;
                                }
                            });
                        }
                    }
                }
                break;

            case 'SetPercentageRequest': {
                    adapter.log.debug(`[ALEXA] ALEXA Percent: ${request.payload.appliance.applianceId} ${request.payload.percentageState.value}%`);
                    for (let channel in channels) {
                        if (!channels.hasOwnProperty(channel)) {
                            continue;
                        }
                        let dimmer = findRoleInChannel(channels[channel], 'level.dimmer');
                        adapter.log.debug('[ALEXA] DATA: ' + JSON.stringify(channels[channel]));
                        adapter.log.debug(dimmer);
                        for (let i = 0; i < channels[channel].length; i++) {
                            let id = channels[channel][i].id;
                            adapter.log.debug('[ALEXA] Controlling percentage: ' + id);
                            controlPercent(dimmer, id, request.payload.percentageState.value, Object.keys(channels).length === 1, err => {
                                err && adapter.log.error(`[ALEXA] Cannot controlPercent: ${err}`);
                                if (!--count) {
                                    request.header.name = 'SetPercentageConfirmation';

                                    callback({
                                        header: request.header,
                                        payload: {}
                                    });
                                    request = null;
                                }
                            });
                        }
                    }
                    writeResponse(request.payload.appliance.applianceId, '%', request.payload.percentageState.value);
                }
                break;

            case 'IncrementPercentageRequest': {
                    adapter.log.debug(`[ALEXA] ALEXA Increment: ${request.payload.appliance.applianceId} ${request.payload.deltaPercentage.value}%`);
                    for (let channel in channels) {
                        if (!channels.hasOwnProperty(channel)) {
                            continue;
                        }
                        let dimmer = findRoleInChannel(channels[channel], 'level.dimmer');

                        adapter.log.debug(`[ALEXA] DATA: ${JSON.stringify(channels[channel])}`);
                        adapter.log.debug(dimmer);

                        for (let i = 0; i < channels[channel].length; i++) {
                            let id = channels[channel][i].id;
                            adapter.log.debug('[ALEXA] Controlling increment percentage: ' + id);
                            controlDelta(dimmer, id, request.payload.percentageState.value, Object.keys(channels).length === 1, err => {
                                err && adapter.log.error(`[ALEXA] Cannot controlDelta: ${err}`);
                                if (!--count) {
                                    request.header.name = 'IncrementPercentageConfirmation';

                                    callback({
                                        header: request.header,
                                        payload: {}
                                    });
                                    request = null;
                                }
                            });
                        }
                    }
                    writeResponse(request.payload.appliance.applianceId, '<>', request.payload.deltaPercentage.value);
                }
                break;

            case 'DecrementPercentageRequest': {
                    adapter.log.debug(`[ALEXA] ALEXA decrement: ${request.payload.appliance.applianceId} ${request.payload.deltaPercentage.value}%`);
                    for (let channel in channels) {
                        if (!channels.hasOwnProperty(channel)) {
                            continue;
                        }
                        let dimmer = findRoleInChannel(channels[channel], 'level.dimmer');

                        adapter.log.debug('[ALEXA] DATA: ' + JSON.stringify(channels[channel]));
                        adapter.log.debug(dimmer);

                        for (let i = 0; i < channels[channel].length; i++) {
                            let id = channels[channel][i].id;
                            adapter.log.debug(`[ALEXA] Controlling decrement percentage: ${id}`);
                            controlDelta(dimmer, id, request.payload.percentageState.value * (-1), Object.keys(channels).length === 1, err => {
                                err && adapter.log.error(`[ALEXA] Cannot controlDelta: ${err}`);
                                if (!--count) {
                                    request.header.name = 'DecrementPercentageConfirmation';

                                    callback({
                                        header: request.header,
                                        payload: {}
                                    });
                                    request = null;
                                }
                            });
                        }
                    }
                    writeResponse(request.payload.appliance.applianceId, '<>', (-1) * request.payload.deltaPercentage.value);
                }
                break;

            case 'SetTargetTemperatureRequest': {
                    adapter.log.debug(`[ALEXA] ALEXA temperature Percent: ${request.payload.appliance.applianceId} ${request.payload.targetTemperature.value} grad`);
                    for (let channel in channels) {
                        if (!channels.hasOwnProperty(channel)) {
                            continue;
                        }
                        let response;

                        for (let i = 0; i < channels[channel].length; i++) {
                            let id = channels[channel][i].id;

                            adapter.log.debug(`[ALEXA] Controlling temperature: ${id}`);

                            controlTemperature(id, request.payload.targetTemperature.value, Object.keys(channels).length === 1, (err, _response) => {
                                err && adapter.log.error(`[ALEXA] Cannot controlTemperature: ${err}`);

                                if (_response && !response) {
                                    response = _response;
                                }

                                if (!--count) {
                                    if (err || !response) {
                                        response = {
                                            payload: {
                                                targetTemperature: {
                                                    value: 0
                                                },
                                                temperatureMode: {
                                                    value: 'AUTO'
                                                },
                                                previousState: {
                                                    targetTemperature: {
                                                        value: 0
                                                    },
                                                    mode: {
                                                        value: 'AUTO'
                                                    }
                                                }
                                            }
                                        };
                                    }
                                    request.header.name = 'SetTargetTemperatureConfirmation';
                                    response.header = request.header;
                                    callback(response);
                                    request = null;
                                }
                            });
                        }
                    }
                }
                break;

            case 'IncrementTargetTemperatureRequest': {
                    request.payload.deltaTemperature.value = request.payload.deltaTemperature.value || 1;
                    adapter.log.debug(`[ALEXA] ALEXA temperature Increment: ${request.payload.appliance.applianceId} ${request.payload.deltaTemperature.value} grad`);
                    let response;

                    for (let channel in channels) {
                        if (!channels.hasOwnProperty(channel)) {
                            continue;
                        }
                        for (let i = 0; i < channels[channel].length; i++) {
                            let id = channels[channel][i].id;
                            adapter.log.debug('[ALEXA] Controlling increment temperature: ' + id);
                            controlTemperatureDelta(id, request.payload.deltaTemperature.value, Object.keys(channels).length === 1, (err, _response) => {
                                err && adapter.log.error(`[ALEXA] Cannot controlTemperatureDelta: ${err}`);

                                if (_response && !response) {
                                    response = _response;
                                }

                                if (!--count) {
                                    if (err || !response) {
                                        response = {
                                            payload: {
                                                targetTemperature: {
                                                    value: 0
                                                },
                                                /*temperatureMode: {
                                                 value: 'AUTO'
                                                 },*/
                                                previousState: {
                                                    targetTemperature: {
                                                        value: 0
                                                    },
                                                    mode: {
                                                        value: 'AUTO'
                                                    }
                                                }
                                            }
                                        };
                                    }
                                    request.header.name = 'IncrementTargetTemperatureConfirmation';
                                    response.header = request.header;
                                    callback(response);
                                    request = null;
                                }
                            });
                        }
                    }
                }
                break;

            case 'DecrementTargetTemperatureRequest': {
                    request.payload.deltaTemperature.value = request.payload.deltaTemperature.value || 1;
                    adapter.log.debug(`[ALEXA] ALEXA temperature decrement: ${request.payload.appliance.applianceId} ${request.payload.deltaTemperature.value} grad`);
                    let response;

                    for (let channel in channels) {
                        if (!channels.hasOwnProperty(channel)) {
                            continue;
                        }

                        for (let i = 0; i < channels[channel].length; i++) {
                            let id = channels[channel][i].id;

                            adapter.log.debug(`[ALEXA] Controlling decrement temperature: ${id}`);

                            controlTemperatureDelta(id, request.payload.deltaTemperature.value * (-1), Object.keys(channels).length === 1, (err, _response) => {
                                err && adapter.log.error(`[ALEXA] Cannot controlTemperatureDelta: ${err}`);

                                if (_response && !response) {
                                    response = _response;
                                }

                                if (!--count) {
                                    if (err || !response) {
                                        response = {
                                            payload: {
                                                targetTemperature: {
                                                    value: 0
                                                },
                                                /*temperatureMode: {
                                                 value: 'AUTO'
                                                 },*/
                                                previousState: {
                                                    targetTemperature: {
                                                        value: 0
                                                    },
                                                    mode: {
                                                        value: 'AUTO'
                                                    }
                                                }
                                            }
                                        };
                                    }
                                    request.header.name = 'DecrementTargetTemperatureConfirmation';
                                    response.header = request.header;
                                    callback(response);
                                    request = null;
                                }
                            });
                        }
                    }
                }
                break;

            case 'GetTemperatureReadingRequest': {
                    adapter.log.debug(`[ALEXA] ALEXA temperature get: ${request.payload.appliance.applianceId}`);
                    let values = 0;
                    let num = 0;
                    for (let channel in channels) {
                        if (!channels.hasOwnProperty(channel)) {
                            continue;
                        }
                        for (let i = 0; i < channels[channel].length; i++) {
                            let id = channels[channel][i].id;

                            adapter.log.debug(`[ALEXA] Get temperature: ${id}`);
                            getTemperature(id, Object.keys(channels).length === 1, (err, value, ts) => {
                                err && adapter.log.error(`[ALEXA] Cannot getTemperature: ${err}`);
                                if (value){
                                    num++;
                                    values += value;
                                }
                                if (!--count) {
                                    request.header.name = 'GetTemperatureReadingResponse';

                                    if (err) {
                                        callback({
                                            header: request.header,
                                            payload: {
                                                temperatureReading: {
                                                    value: 0
                                                },
                                                applianceResponseTimestamp: new Date().toISOString()
                                            }
                                        });
                                    } else {
                                        callback({
                                            header: request.header,
                                            payload: {
                                                temperatureReading: {
                                                    value: Math.round(values * 10 / num) / 10
                                                },
                                                applianceResponseTimestamp: ts ? new Date(ts).toISOString() : new Date().toISOString()
                                            }
                                        });
                                    }

                                    request = null;
                                }
                            });
                        }
                    }
                }
                break;

            case 'GetTargetTemperatureRequest': {
                    adapter.log.debug(`[ALEXA] ALEXA TargetTemperature get: ${request.payload.appliance.applianceId}`);
                    let result;
                    for (let channel in channels) {
                        if (!channels.hasOwnProperty(channel)) {
                            continue;
                        }
                        for (let i = 0; i < channels[channel].length; i++) {
                            let id = channels[channel][i].id;

                            adapter.log.debug(`[ALEXA] Getting target temperature: ${id}`);

                            getTargetTemperature(id, Object.keys(channels).length === 1, (err, value, ts) => {
                                err && adapter.log.error(`[ALEXA] Cannot getTargetTemperature: ${err}`);
                                if (!result && value) result = value;
                                if (!--count) {
                                    request.header.name = 'GetTargetTemperatureResponse';
                                    adapter.log.debug(`[ALEXA] Got: ${value}`);

                                    callback({
                                        header: request.header,
                                        payload: {
                                            targetTemperature: {
                                                value: result
                                            },
                                            temperatureMode: {
                                                value: 'CUSTOM',
                                                friendlyName: ''
                                            },
                                            applianceResponseTimestamp: ts ? new Date(ts).toISOString() : new Date().toISOString()
                                        }
                                    });

                                    request = null;
                                }
                            });
                        }
                    }
                }
                break;

            case 'SetColorRequest': {
                    adapter.log.debug(`[ALEXA] ALEXA Color: ${request.payload.appliance.applianceId} ${JSON.stringify(request.payload.color)}`);
                    let doneCallback = err => {
                        err && adapter.log.error(`[ALEXA] Cannot SetColorRequest: ${err}`);
                        adapter.log.debug(`[ALEXA]  Hue Count: ${count}`);

                        if (!--count) {
                            adapter.log.debug(`[ALEXA]  Done Count: ${count}`);
                            request.header.name = 'SetColorConfirmation';

                            callback({
                                header: request.header,
                                payload: {
                                    achievedState: {
                                        color: JSON.parse(JSON.stringify(request.payload.color))
                                    }
                                }
                            });
                            request = null;
                        }
                    };

                    count = Object.keys(channels).length;

                    for (let channel in channels) {
                        if (!channels.hasOwnProperty(channel)) {
                            continue;
                        }
                        let hue = findRoleInChannel(channels[channel], 'level.color.hue');
                        if (hue) {
                            adapter.log.debug(`[ALEXA]  Using HUE for: ${channel}`);
                            let sat = findRoleInChannel(channels[channel], 'level.color.saturation');
                            let bri = findRoleInChannel(channels[channel], 'level.dimmer');
                            let color = JSON.parse(JSON.stringify(request.payload.color));
                            controlColorHue(sat, hue, bri, color, Object.keys(channels).length === 1, doneCallback);
                            continue;
                        }

                        let rgb = findRoleInChannel(channels[channel], 'level.color.rgb');
                        if (rgb) {
                            adapter.log.debug(`[ALEXA]  Using RGB for: ${channel}`);
                            let color = JSON.parse(JSON.stringify(request.payload.color));
                            controlColorRgb(rgb, color, Object.keys(channels).length === 1, doneCallback);
                            continue;
                        }
                        adapter.log.debug(`[ALEXA]  Unable to set color for: ${channel}`);
                        adapter.log.debug(`[ALEXA] Count: ${count}`);
                        doneCallback();
                    }
                    //writeResponse(request.payload.appliance.applianceId, '%', request.payload.percentageState.value);
                }
                break;

            case 'SetColorTemperatureRequest': {
                    for (let channel in channels) {
                        if (!channels.hasOwnProperty(channel)) {
                            continue;
                        }
                        let temperature = findRoleInChannel(channels[channel], 'level.color.temperature');
                        for (let i = 0; i < channels[channel].length; i++) {
                            let id = channels[channel][i].id;
                            adapter.log.debug(`[ALEXA] Controlling temperature kelvin: ${id}`);

                            controlColorTemperature(temperature, id, request.payload.colorTemperature.value, Object.keys(channels).length === 1, err => {
                                err && adapter.log.error(`[ALEXA] Cannot controlColorTemperature: ${err}`);
                                if (!--count) {
                                    request.header.name = 'SetColorTemperatureConfirmation';
                                    adapter.log.debug(`[ALEXA] DONE: ${id}`);

                                    callback({
                                        header: request.header,
                                        payload: {
                                            achievedState: {
                                              colorTemperature: {
                                                value: request.payload.colorTemperature.value
                                              }
                                            }
                                          }
                                    });
                                    request = null;
                                }
                            });
                        }
                    }
                }
                break;

            case 'IncrementColorTemperatureRequest': {
                    for (let channel in channels) {
                        if (!channels.hasOwnProperty(channel)) continue;
                        let temperature = findRoleInChannel(channels[channel], 'level.color.temperature');
                        for (let i = 0; i < channels[channel].length; i++) {
                            let id = channels[channel][i].id;
                            adapter.log.debug('[ALEXA] Controlling temperature kelvin: ' + id);
                            controlColorTemperatureDelta(temperature, id, -1, Object.keys(channels).length === 1, (err, res) => {
                                err && adapter.log.error(`[ALEXA] Cannot controlColorTemperatureDelta: ${err}`);
                                adapter.log.debug(`[ALEXA] Count: ${count}`);
                                if (!--count) {
                                    request.header.name = 'IncrementColorTemperatureConfirmation';
                                    adapter.log.debug(`[ALEXA] DONE: ${id}`);

                                    callback({
                                        header: request.header,
                                        payload: {
                                            achievedState: {
                                              colorTemperature: {
                                                value: res
                                              }
                                            }
                                          }
                                    });
                                    request = null;
                                }
                            });
                        }
                    }
                }
                break;

            case 'DecrementColorTemperatureRequest': {
                    for (let channel in channels) {
                        if (!channels.hasOwnProperty(channel)) continue;
                        let temperature = findRoleInChannel(channels[channel], 'level.color.temperature');
                        for (let i = 0; i < channels[channel].length; i++) {
                            let id = channels[channel][i].id;
                            adapter.log.debug(`[ALEXA] Controlling temperature kelvin: ${id}`);

                            controlColorTemperatureDelta(temperature, id, 1, Object.keys(channels).length === 1, (err, res) => {
                                err && adapter.log.error(`[ALEXA] Cannot controlColorTemperatureDelta: ${err}`);
                                adapter.log.debug(`[ALEXA] Count: ${count}`);

                                if (!--count) {
                                    request.header.name = 'DecrementColorTemperatureConfirmation';
                                    adapter.log.debug(`[ALEXA] DONE: ${id}`);

                                    callback({
                                        header: request.header,
                                        payload: {
                                            achievedState: {
                                              colorTemperature: {
                                                value: res
                                              }
                                            }
                                          }
                                    });
                                    request = null;
                                }
                            });
                        }
                    }
                }
                break;

            case 'HealthCheckRequest': {
                    request.header.name = 'HealthCheckResponse';
                    try {
                        adapter.log.debug(`[ALEXA] HealthCheckRequest duration: ${new Date().getTime() - request.payload.initiationTimestamp} ms`);
                    } catch (e) {
                        adapter.log.error('[ALEXA] No payload');
                    }

                    callback({
                        header: request.header,
                        payload: {
                            description: 'Das System ist OK', // ?? What about english?
                            isHealthy: true
                        }
                    });
                    request = null;
                }
                break;

            default: {
                    request.header.name = 'NotSupportedInCurrentModeError';
                    callback({
                        header: request.header,
                        payload: {}
                    });
                    request = null;
                }
                break;
        }
    };

    this.updateDevices = function (_addedId, callback) {
        if (typeof _addedId === 'function') {
            callback = _addedId;
            _addedId = null;
        }

        addedId = _addedId;

        this.getDevices((err, result, analyseAddedId) => {
            addedId = null;
            smartDevices = result;
            callback && callback(analyseAddedId);
        });
    };

    this.getEnums = function () {
        return enums;
    };

    this.getDevices = function (callback) {
        if (!callback) return smartDevices;
        adapter.getObjectView('system', 'state', {}, (err, _states) => {
            let states   = {};
            let ids      = [];
            let alexaIds = [];
            let groups   = {};
            let names    = {};
            enums        = [];

            if (_states && _states.rows) {
                for (let i = 0; i < _states.rows.length; i++) {
                    if (_states.rows[i].value) {
                        states[_states.rows[i].id] = _states.rows[i].value;
                        ids.push(_states.rows[i].id);

                        if (adapter.config.noCommon) {
                            if (_states.rows[i].value.common &&
                                _states.rows[i].value.common.custom &&
                                _states.rows[i].value.common.custom[adapter.namespace] &&
                                _states.rows[i].value.common.custom[adapter.namespace].smartName &&
                                _states.rows[i].value.common.custom[adapter.namespace].smartName !== 'ignore') {
                                alexaIds.push(_states.rows[i].id);
                            }
                        } else {
                            if (_states.rows[i].value.common &&
                                _states.rows[i].value.common.smartName &&
                                _states.rows[i].value.common.smartName !== 'ignore') {
                                alexaIds.push(_states.rows[i].id);
                            }
                        }
                    }
                }
            }
            ids.sort();
            adapter.getObjectView('system', 'enum', {}, (err, doc) => {
                // Build overlap from rooms and functions
                let rooms = [];
                let funcs = [];
                let smartName;
                if (doc && doc.rows) {
                    for (let i = 0, l = doc.rows.length; i < l; i++) {
                        if (doc.rows[i].value) {
                            let _id = doc.rows[i].id;
                            smartName = getSmartName(doc.rows[i].value);
                            if (_id.match(/^enum\.rooms\./)     && smartName !== 'ignore' && smartName !== false) {
                                rooms.push(doc.rows[i].value);
                            }
                            if (_id.match(/^enum\.functions\./) && smartName !== 'ignore' && smartName !== false) {
                                funcs.push(doc.rows[i].value);
                            }
                            if (_id.match(/^enum\.rooms\./) || _id.match(/^enum\.functions\./)) {
                                if (!doc.rows[i].value) {
                                    doc.rows[i].value = {};
                                }
                                if (!doc.rows[i].value.common) {
                                    doc.rows[i].value.common = {};
                                }

                                const en = {
                                    id:         _id,
                                    name:       doc.rows[i].value.common.name,
                                    color:      doc.rows[i].value.common.color,
                                    icon:       doc.rows[i].value.common.icon,
                                    type:       'enum',
                                    smartName:  smartName
                                };
                                if (typeof en.name === 'object') {
                                    en.name = en.name[lang] || en.name.en;
                                }
                                enums.push(en);
                            }
                        }
                    }
                }
                let result = [];
                for (let f = 0; f < funcs.length; f++) {
                    if (!funcs[f].common || !funcs[f].common.members || typeof funcs[f].common.members !== 'object' || !funcs[f].common.members.length) {
                        continue;
                    }

                    for (let s = 0; s < funcs[f].common.members.length; s++) {
                        let id = funcs[f].common.members[s];
                        if (typeof id !== 'string') {
                            continue;
                        }
                        smartName = getSmartName(funcs[f]);
                        if (smartName && typeof smartName === 'object') {
                            smartName = smartName[lang] || smartName.en;
                        }
                        let func = smartName || funcs[f].common.name;

                        if (!func) {
                            func = funcs[f]._id.substring('enum.functions.'.length);
                            func = func[0].toUpperCase() + func.substring(1);
                        }

                        // Find room
                        let room = '';
                        for (let r = 0; r < rooms.length; r++) {
                            if (!rooms[r].common || !rooms[r].common.members || typeof rooms[r].common.members !== 'object' || !rooms[r].common.members.length) continue;

                            if (rooms[r].common.members.includes(id)) {
                                smartName = getSmartName(rooms[r]);
                                if (smartName && typeof smartName === 'object') {
                                    smartName = smartName[lang] || smartName.en;
                                }
                                room = smartName || rooms[r].common.name;
                                if (!room) {
                                    room = rooms[r]._id.substring('enum.rooms.'.length);
                                    room = room[0].toUpperCase() + room.substring(1);
                                }
                            }

                            if (!room) {
                                // may be the channel is in the room
                                let _parts = id.split('.');
                                _parts.pop();
                                let channel = _parts.join('.');
                                if (rooms[r].common.members.includes(channel)) {
                                    smartName = getSmartName(funcs[f]);
                                    if (smartName && typeof smartName === 'object') {
                                        smartName = smartName[lang] || smartName.en;
                                    }

                                    room = smartName || rooms[r].common.name;

                                    if (!room) {
                                        room = rooms[r]._id.substring('enum.rooms.'.length);
                                        room = room[0].toUpperCase() + room.substring(1);
                                    }
                                }
                            }
                            if (room) {
                                break;
                            }
                        }

                        if (!states[id]) {
                            let m = new RegExp('^' + id.replace(/\./g, '\\.'));
                            for (let ii = 0; ii < ids.length; ii++) {
                                if (ids[ii] < id) {
                                    continue;
                                }
                                if (m.exec(ids[ii])) {
                                    if (states[ids[ii]].common.role && (
                                            states[ids[ii]].common.role === 'state'  ||
                                            states[ids[ii]].common.role.match(/^switch/) ||
                                            states[ids[ii]].common.role.match(/^level/)
                                        )) {
                                        processState(states, ids[ii], room, func, alexaIds, groups, names, result);
                                    }
                                    continue;
                                }
                                break;
                            }
                        } else {
                            processState(states, id, room, func, alexaIds, groups, names, result);
                        }
                    }
                }

                let analyseAddedId = null;

                // process states with defined smartName
                for (let j = 0; j < alexaIds.length; j++) {
                    const errorText = processState(states, alexaIds[j], null, null, null, groups, names, result);
                    if (addedId && !analyseAddedId && alexaIds[j] === addedId && errorText) {
                        adapter.log.error(errorText);
                        analyseAddedId = errorText;
                    }
                }

                result.sort((a, b) => {
                    let fnA = a.friendlyName;
                    if (typeof fnA === 'object') {
                        fnA = fnA[lang] || fnA['en'];
                    }
                    let fnB = b.friendlyName;
                    if (typeof fnB === 'object') {
                        fnB = fnB[lang] || fnB['en'];
                    }
                    if (fnA > fnB) {
                        return 1;
                    } else
                    if (fnA < fnB) {
                        return -1;
                    } else {
                        return 0;
                    }
                });

                for (let k = result.length - 1; k >= 0; k--) {
                    if (result[k].disabled) {
                        result.splice(k, 1);
                    } else {
                        let fn = result[k].friendlyName;
                        if (typeof fn === 'object') {
                            fn = fn[lang] || fn['en'];
                        }
                        adapter.log.debug(`[ALEXA] Created ALEXA device: ${fn} ${JSON.stringify(result[k].actions)}`);
                    }
                }

                if (result.length > 300) {
                    adapter.log.error(`[ALEXA] too many devices ${result.length}. Max supported number is 300`);
                }

                callback(err, result, analyseAddedId);
            });
        });
    }
}

module.exports = AlexaSH2;

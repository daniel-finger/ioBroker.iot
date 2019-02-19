import React, {Component} from 'react';
import {withStyles} from '@material-ui/core/styles';
import PropTypes from 'prop-types';
import TextField from '@material-ui/core/TextField';
import Button from '@material-ui/core/Button';
import IconButton from '@material-ui/core/IconButton';
import Utils from '../Components/Utils'
import Fab from '@material-ui/core/Fab';
import CircularProgress from '@material-ui/core/CircularProgress';
import Input from '@material-ui/core/Input';
import Badge from '@material-ui/core/Badge';
import Select from '@material-ui/core/Select';
import MenuItem from '@material-ui/core/MenuItem';
import FormHelperText from '@material-ui/core/FormHelperText';
import FormControl from '@material-ui/core/FormControl';

import {MdEdit as IconEdit} from 'react-icons/md';
import {MdAdd as IconAdd} from 'react-icons/md';
import {MdClear as IconClear} from 'react-icons/md';
import {MdDelete as IconDelete} from 'react-icons/md';
import {MdFormatAlignJustify as IconExpand} from 'react-icons/md';
import {MdDragHandle as IconCollapse} from 'react-icons/md';

import {FaPowerOff as IconOn} from 'react-icons/fa';
import {FaThermometerHalf as IconTemperature} from 'react-icons/fa';
import {FaLongArrowAltUp as IconUp} from 'react-icons/fa';
import {FaLongArrowAltDown as IconDown} from 'react-icons/fa';
import {FaPercentage as IconPercentage} from 'react-icons/fa';
import {FaPalette as IconColor} from 'react-icons/fa';
import {FaLightbulb as IconBulb} from 'react-icons/fa';
import {FaLockOpen as IconLock} from 'react-icons/fa';
import {FaThermometer as IconThermometer} from 'react-icons/fa';

import I18n from '../i18n';
import DialogTitle from "@material-ui/core/DialogTitle";
import DialogContent from "@material-ui/core/DialogContent";
import DialogActions from "@material-ui/core/DialogActions";
import Dialog from "@material-ui/core/Dialog";
import MessageDialog from '../Dialogs/Message';

const colorOn = '#aba613';
const colorOff = '#444';
const colorSet = '#00c6ff';
const colorRead = '#00bc00';

const actionsMapping = {
    turnOn: {color: colorOn, icon: IconOn, desc: 'Turn on'},
    turnOff: {color: colorOff, icon: IconOn, desc: 'Turn off'},

    setTargetTemperature: {color: colorSet, icon: IconTemperature, desc: 'Set target temperature'},
    incrementTargetTemperature: {color: colorOn, icon: IconUp, desc: 'Increment target temperature'},
    decrementTargetTemperature: {color: colorOff, icon: IconDown, desc: 'Decrement target temperature'},

    setPercentage: {color: colorSet, icon: IconPercentage, desc: 'Set percentage'},
    incrementPercentage: {color: colorOn, icon: IconUp, desc: 'Increment percentage'},
    decrementPercentage: {color: colorOff, icon: IconDown, desc: 'Decrement percentage'},

    setColor: {color: colorSet, icon: IconColor, desc: 'Set color'},

    setColorTemperature: {color: colorSet, icon: IconBulb, desc: 'Set color temperature'},
    incrementColorTemperature: {color: colorOn, icon: IconUp, desc: 'Increment color temperature'},
    decrementColorTemperature: {color: colorOff, icon: IconDown, desc: 'Decrement color temperature'},

    getTargetTemperature: {color: colorRead, icon: IconThermometer, desc: 'Get target temperature'},
    getTemperatureReading: {color: colorRead, icon: IconThermometer, desc: 'Get actual temperature'},

    setLockState: {color: colorSet, icon: IconLock, desc: 'Set lock state'},
    getLockState: {color: colorRead, icon: IconLock, desc: 'Read lock state'},
};

const SMARTTYPES = ['LIGHT', 'SWITCH', 'THERMOSTAT', 'ACTIVITY_TRIGGER', 'SCENE_TRIGGER', 'SMARTPLUG', 'SMARTLOCK', 'CAMERA'];

const styles = theme => ({
    tab: {
        width: '100%',
        height: '100%'
    },
    column: {
        display: 'inline-block',
        verticalAlign: 'top',
        marginRight: 20,
        height: '100%',
        overflow: 'hidden'
    },
    columnDiv: {
        height: 'calc(100% - 60px)',
        overflow: 'auto',
        minWidth: 300
    },
    filter: {
        margin: 0
    },
    button: {
        marginRight: 20
    },
    devLineExpand: {
        marginRight: 10,
    },
    devLineEnabled: {
        position: 'absolute',
        right: 0,
        top: 0,
    },
    devLineEdit: {
        position: 'absolute',
        top: 5,
        right: 50
    },
    devLineDelete: {
        position: 'absolute',
        top: 0,
        right: 0
    },
    devLineName: {

    },
    devLineNumber:{
        display: 'inline-block',
        verticalAlign: 'middle',
        width: 15,
    },
    enumLineSubName:{
        fontStyle: 'italic',
    },
    devLine: {
        height: 48,
        width: '100%',
        position: 'relative'
    },
    devLineDescription: {
        display: 'block',
        fontStyle: 'italic',
        fontSize: 12
    },
    devLineActions: {
        fontStyle: 'italic',
        fontSize: 12,
        paddingLeft: 20
    },
    devLineNameBlock: {
        display: 'inline-block',
        width: 'calc(100% - 350px)'
    },
    columnHeader: {
        background: theme.palette.primary.light,
        padding: 10,
        color: theme.palette.primary.contrastText
    },
    devModified: {
        fontStyle: 'italic'
    },
    actionIcon: {
        width: 16
    },

    devSubLine: {
        position: 'relative',
        height: 48
    },
    devSubLineName: {
        marginLeft: 80,
        marginTop: 14,
        display: 'inline-block',
        fontSize: 13,
        width: 'calc(100% - 340px)'
    },
    devSubLineByOn: {
        marginLeft: 5
    },
    devSubLineDelete: {
        position: 'absolute',
        top: 12,
        right: 12,
        padding: 0
    },
    devSubLineEdit: {
        position: 'absolute',
        top: 12,
        right: 62,
        padding: 0
    },
    devSubLineTypeTitle: {
        marginTop: 0
    }
});

const adapterName = 'iot.';

class AlexaSmartNames extends Component {
    constructor(props) {
        super(props);

        if (!actionsMapping.translated) {
            Object.keys(actionsMapping).forEach(a => actionsMapping[a].desc = I18n.t(actionsMapping[a].desc));
            actionsMapping.translated = true;
        }

        this.state = {
            inAction: false,
            editedSmartName: '',
            editId: '',
            changed: [],
            devices: [],
            message: '',
            filter: '',
            loading: true,
            expanded: []
        };

        this.editDevice = false;

        this.props.socket.getObject(`system.adapter.${adapterName}${this.props.instance}`).then(obj => {
            this.props.socket.getState(`system.adapter.${adapterName}${this.props.instance}.alive`).then(state => {
                if (!obj || !obj.common || (!obj.common.enabled && (!state || !state.val))) {
                    this.setState({message: I18n.t('Instance must be enabled'), loading: false, devices: []});
                } else {
                    this.props.socket.sendTo(adapterName + this.props.instance, 'browse', null, list => {
                        this.setState({devices: list, loading: false});
                    });
                }
            });
        });
    }

    informInstance(id) {
        this.props.socket.sendTo(adapterName + this.props.instance, 'update', id);
    }

    addChanged(id) {
        const changed = JSON.parse(JSON.stringify(this.state.changed));
        if (changed.indexOf(id) === -1) {
            changed.push(id);
            this.setState({changed});
        }
    }

    removeChanged(id) {
        const changed = JSON.parse(JSON.stringify(this.state.changed));
        const pos = changed.indexOf(id);

        if (pos !== -1) {
            changed.splice(pos, 1);
            this.setState({changed});
        }
    }

    updateObjInState(dev) {
        // update obj
        for (let i = 0; i < this.state.devices.length; i++) {
            if (this.state.devices[i].additionalApplianceDetails.id === dev._id) {
                const devices = JSON.parse(JSON.stringify(this.state.devices));
                devices[i] = dev;
                this.setState({devices});
                break;
            }
        }
    }

    onEdit(id) {
        const device = this.state.devices.find(dev => dev.additionalApplianceDetails.id === id);
        let smartName = device.additionalApplianceDetails.friendlyNames ? device.additionalApplianceDetails.friendlyNames : device.friendlyName;
        if (typeof smartName === 'object' && smartName) {
            smartName = smartName[I18n.getLanguage()] || smartName.en;
        }
        this.setState({editId: id, editedSmartName: smartName});
    }

    onDelete(id) {
        const device = this.state.devices.find(dev => dev.additionalApplianceDetails.id === id);
    }

    renderActions(dev) {
        // Type
        const actions = [];
        if (!dev.actions) {
            console.log('Something went wrong');
            return null;
        }
        dev.actions.sort((a, b) => {
            if (a === b) return 0;
            if (a === 'turnOn') return -1;
            if (b === 'turnOn') return 1;

            if (a === 'turnOff') return -1;
            if (b === 'turnOff') return 1;
            return 0;
        });

        Object.keys(actionsMapping).forEach(action => {
            if (dev.actions.indexOf(action) !== -1) {
                const Icon = actionsMapping[action].icon;
                actions.push((<span key={action} title={actionsMapping[action].desc}><Icon className={this.props.classes.actionIcon} style={{color: actionsMapping[action].color}}/></span>));
            }
        });
        // add unknown actions
        for (let a = 0; a < dev.actions.length; a++) {
            if (!actionsMapping[dev.actions[a]]) {
                actions.push((<span key={dev.actions[a]}>{dev.actions[a]}</span>));
            }
        }
        return actions;
    }

    onExpand(lineNum) {
        const expanded = JSON.parse(JSON.stringify(this.state.expanded));
        const pos = expanded.indexOf(this.state.devices[lineNum].friendlyName);
        if (pos === -1) {
            expanded.push(this.state.devices[lineNum].friendlyName);
        } else {
            expanded.splice(pos, 1);
        }
        this.setState({expanded});
    }

    onByONChange() {

    }

    renderSelectByOn(dev, lineNum, id, type) {
        // type = '-', 'stored', false or number [5-100]
        if (type !== false) {
            const items = [
                (<MenuItem value=""><em>{I18n.t('Default')}</em></MenuItem>),
                (<MenuItem value="stored">{I18n.t('last value')}</MenuItem>)
            ];
            for (let i = 5; i <= 100; i += 5) {
                items.push((<MenuItem value={i.toString()}>{i}%</MenuItem>));
            }
            return (<FormControl className={this.props.classes.devSubLineByOn}>
                <Select className={this.props.classes.devSubLineByOnSelect} value={(type || '').toString()} onChange={() => this.onByONChange()}>{items}</Select>
                <FormHelperText className={this.props.classes.devSubLineTypeTitle}>{I18n.t('by ON')}</FormHelperText>
            </FormControl>);
        } else {
            return null;
        }
    }

    onTypeChange() {

    }

    renderSelectType(dev, lineNum, id, type) {
        if (type !== false) {
            const items = [
                (<MenuItem value="_"><em>{I18n.t('no type')}</em></MenuItem>)
            ];
            for (let i = 0; i < SMARTTYPES.length; i++) {
                items.push((<MenuItem value={SMARTTYPES[i]}><em>{I18n.t(SMARTTYPES[i])}</em></MenuItem>));
            }
            return (
                <FormControl>
                    <Select value={type || '_'} onChange={() => this.onTypeChange()}>{items}</Select>
                    <FormHelperText className={this.props.classes.devSubLineTypeTitle}>{I18n.t('Types')}</FormHelperText>
                </FormControl>);
        } else {
            return '';
        }
    }

    renderChannels(dev, lineNum) {
        const result = [];
        const classes = this.props.classes;

        if (dev.additionalApplianceDetails.group) {
            const channels   = dev.additionalApplianceDetails.channels;
            const names      = dev.additionalApplianceDetails.names;
            const types      = dev.additionalApplianceDetails.byONs;
            const smarttypes = dev.additionalApplianceDetails.smartTypes;

            let c = 0;
            for (const chan in channels) {
                if (channels.hasOwnProperty(chan)) {
                    for (let i = 0; i < channels[chan].length; i++) {
                        const id = channels[chan][i].id;
                        result.push((<div className={classes.devSubLine} style={(c % 2) ? {} : {background: '#e9e9e9'}}>
                            <div className={classes.devSubLineName} title={id}>{(names[id] || id)}</div>
                            {this.renderSelectType(dev, lineNum, id, smarttypes[id])}
                            {this.renderSelectByOn(dev, lineNum, id, types[id])}
                            <IconButton aria-label="Delete" className={this.props.classes.devSubLineDelete} onClick={() => this.onDelete(lineNum, id)}><IconDelete fontSize="middle" /></IconButton>
                        </div>));
                        c++;
                    }
                }
            }
        } else {
            const id = dev.additionalApplianceDetails.id;
            const name = dev.additionalApplianceDetails.name || id;
            result.push((<div className={classes.devSubLine} style={{background: '#e9e9e9'}}>
                <div className={classes.devSubLineName} title={(id || '')}>{name}</div>
                {this.renderSelectType(dev, lineNum, id, dev.additionalApplianceDetails.smartType)}
                {this.renderSelectByOn(dev, lineNum, id, dev.additionalApplianceDetails.byON)}
                <IconButton aria-label="Delete" className={this.props.classes.devSubLineDelete} onClick={() => this.onDelete(lineNum, id)}><IconDelete fontSize="middle" /></IconButton>
            </div>));
        }
        return result;
    }

    renderDevice(dev, lineNum) {
        let friendlyName = dev.friendlyName;
        let title;
        if (!dev.additionalApplianceDetails.group && dev.additionalApplianceDetails.nameModified) {
            title = friendlyName;
        } else {
            title = (<span className={this.props.classes.devModified} title={I18n.t('modified')}>{friendlyName}</span>);
        }

        let devCount = 0;
        for (const ch in dev.additionalApplianceDetails.channels) {
            if (dev.additionalApplianceDetails.channels.hasOwnProperty(ch)) {
                devCount += dev.additionalApplianceDetails.channels[ch].length;
            }
        }
        devCount = devCount || 1;
        const expanded = this.state.expanded.indexOf(friendlyName) !== -1;
        const id = dev.additionalApplianceDetails.id;

        return [
            (<div key={'line' + lineNum} className={this.props.classes.devLine} style={{background: (lineNum % 2) ? '#f1f1f1' : 'inherit'}}>
                <div className={this.props.classes.devLineNumber}>{lineNum + 1}.</div>
                <IconButton aria-label="4 pending messages" className={this.props.classes.devLineExpand} onClick={() => this.onExpand(lineNum)}>
                    {devCount > 1 ?
                        (<Badge badgeContent={devCount} color="primary">
                            {expanded ? (<IconCollapse/>) : (<IconExpand />)}
                        </Badge>) :
                        (expanded ? (<IconCollapse/>) : (<IconExpand />))}
                </IconButton>
                <div className={this.props.classes.devLineNameBlock} style={{display: 'inline-block'}}>
                    <span className={this.props.classes.devLineName}>{title}</span>
                    <span className={this.props.classes.devLineDescription}>{dev.friendlyDescription}</span>
                </div>
                <span className={this.props.classes.devLineActions}>{this.renderActions(dev)}</span>
                {!dev.additionalApplianceDetails.group ?
                    (<IconButton aria-label="Edit" className={this.props.classes.devLineEdit} onClick={() => this.onEdit(id)}><IconEdit fontSize="middle" /></IconButton>) : null}
                {!dev.additionalApplianceDetails.group ?
                    (<IconButton aria-label="Delete" className={this.props.classes.devLineDelete} onClick={() => this.onDelete(id)}><IconDelete fontSize="middle" /></IconButton>) : null}
            </div>),
            expanded ? this.renderChannels(dev, lineNum) : null
        ];
    }

    renderMessage() {
        if (this.state.message) {
            return (<MessageDialog text={this.state.message} onClose={() => this.setState({message: ''})}/>);
        } else {
            return null;
        }
    }

    changeSmartName() {
        // Check if the name is duplicate
        this.addChanged(this.state.editId);
        setTimeout(() => this.removeChanged(this.state.editId), 500);
        const id = this.state.editId;
        this.setState({editId: ''});
        let newObj;
        this.props.socket.getObject(id)
            .then(obj => {
                Utils.updateSmartName(obj, this.state.editedSmartName, undefined, undefined, adapterName + this.props.instance, this.props.native.noCommon);
                newObj = obj;
                return this.props.socket.setObject(id, obj);
            })
            .then(() => {
                // update obj
                this.updateObjInState(newObj);
                this.informInstance(id);
            })
            .catch(err => this.props.onError(err));
    }

    renderEditDialog() {
        if (this.state.editDevice) {
            return (<Dialog
                open={true}
                maxWidth="sm"
                fullWidth={true}
                onClose={() => this.handleOk()}
                aria-labelledby="message-dialog-title"
                aria-describedby="message-dialog-description"
            >
                <DialogTitle id="message-dialog-title">{this.props.title || I18n.t('Smart name for %s', this.state.editDevice.modelName)}</DialogTitle>
                <DialogContent>
                    <TextField
                        style={{width: '100%'}}
                        label={I18n.t('Smart name')}
                        onChange={e => this.setState({editedSmartName: e.target.value})}
                        value={this.state.editedSmartName}
                        helperText={I18n.t('You can enter several names divided by comma')}
                        margin="normal"
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => this.changeSmartName()} color="primary" autoFocus>{I18n.t('Ok')}</Button>
                    <Button onClick={() => this.setState({editId: ''})}>{I18n.t('Cancel')}</Button>
                </DialogActions>
            </Dialog>)
        } else {
            return null;
        }
    }

    renderDevices() {
        const filter = this.state.filter.toLowerCase();
        const result = [];
        for (let i = 0; i < this.state.devices.length; i++) {
            if (this.state.filter && this.state.devices[i].friendlyName.toLowerCase().indexOf(filter) === -1 ) continue;
            result.push(this.renderDevice(this.state.devices[i], i));
        }
        return result;
    }

    render() {
        if (this.state.loading) {
            return (<CircularProgress />);
        }

        return (
            <form className={this.props.classes.tab}>
                <Fab size="small" color="secondary" aria-label="Add" className={this.props.classes.button}><IconAdd /></Fab>

                <Input
                    placeholder={I18n.t('Filter')}
                    className={this.state.filter}
                    value={this.state.filter}
                    onChange={e => this.setState({filter: e.target.value})}
                />
                <IconButton aria-label="Clear" className={this.props.classes.button} onClick={() => this.setState({filter: ''})}><IconClear fontSize="large" /></IconButton>
                {this.renderDevices()}
                {this.renderMessage()}
                {this.renderEditDialog()}
            </form>
        );
    }
}

AlexaSmartNames.propTypes = {
    common: PropTypes.object.isRequired,
    native: PropTypes.object.isRequired,
    instance: PropTypes.number.isRequired,
    onError: PropTypes.func,
    onLoad: PropTypes.func,
    onChange: PropTypes.func,
    socket: PropTypes.object.isRequired,
};

export default withStyles(styles)(AlexaSmartNames);

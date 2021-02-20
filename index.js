// Dolby Cinema Processor

var udp = require('../../udp');
var instance_skel = require('../../instance_skel');
var debug;
var log;

function instance(system, id, config) {
	let self = this;

	// super-constructor
	instance_skel.apply(this, arguments);

	self.actions(); // export actions

	return self;
}

instance.prototype.screens = []; //the internal array for screens and their values

instance.prototype.CHOICES_SCREENS = []; //the Companion dropdown list formatted version

instance.prototype.CHOICES_BLENDING_MODES = [
	{ id: '0', label: 'Absolute' },
	{ id: '1', label: 'Relative to Profile' }
];

instance.prototype.CHOICES_CALIBRATION_PATTERNS = [
	{ id: 'transparent', label: 'None' },
	{ id: 'colorTargets', label: 'Color Patterns' },
	{ id: 'grayscaleTargets', label: 'Grayscale Patterns' }
];

instance.prototype.updateConfig = function(config) {
	let self = this;

	self.config = config;
	self.initVariables();
	self.init_udp();
};

instance.prototype.init = function() {
	let self = this;

	debug = self.debug;
	log = self.log;

	self.initVariables();
	self.init_udp();
};

instance.prototype.init_udp = function() {
	let self = this;

	if (self.udp !== undefined) {
		self.udp.destroy();
		delete self.udp;
	}

	self.status(self.STATE_WARNING, 'Connecting');

	if (self.config.host !== undefined) {
		self.udp = new udp(self.config.host, 44188);
		let cmd = 'Gmaestro sub ';
		self.udp.send(cmd);

		self.udp.on('error', function (err) {
			debug("Network error", err);
			self.status(self.STATE_ERROR, err);
			self.log('error',"Network error: " + err.message);
		});

		self.udp.on('data', function (data) {
			self.status(self.STATE_OK);
			self.processFeedback(data);
		});

		self.udp.on('status_change', function (status, message) {
			self.status(status, message);
		});
	}
};

instance.prototype.initVariables = function () {
	let self = this;

	let variables = [
	];

	self.setVariableDefinitions(variables);
};

// Return config fields for web config
instance.prototype.config_fields = function () {
	let self = this;

	return [
		{
			type: 'text',
			id: 'info',
			width: 12,
			label: 'Information',
			value: 'This module will connect to Gamma Control or Gamma Board software.'
		},
		{
			type: 'textinput',
			id: 'host',
			label: 'IP Address',
			width: 6,
			default: '192.168.0.1',
			regex: self.REGEX_IP
		}
	]
};

// When module gets deleted
instance.prototype.destroy = function() {
	let self = this;

	if (self.udp !== undefined) {
		self.udp.destroy();
	}

	debug('destroy', self.id);
}

instance.prototype.actions = function() {
	let self = this;

	self.system.emit('instance_actions', self.id, {

		'set_values': {
			label: 'Set Values',
			options: [
				{
					type: 'dropdown',
					label: 'Screen',
					id: 'screen',
					choices: self.CHOICES_SCREENS
				},
				{
					type: 'dropdown',
					label: 'Blending Mode',
					id: 'blending_mode',
					default: '0',
					choices: self.CHOICES_BLENDING_MODES
				},
				{
					type: 'textinput',
					label: 'Master-Black Value',
					id: 'master_black',
					tooltip: '(0.0-1.0)',
					default: '0.0',
					required: true
				},
				{
					type: 'textinput',
					label: 'Master-Middle Value',
					id: 'master_middle',
					tooltip: '(0.5-1.5)',
					default: '1.0',
					required: true
				},
				{
					type: 'textinput',
					label: 'Master-White Value',
					id: 'master_white',
					tooltip: '(0.0-1.0)',
					default: '1.0',
					required: true
				},
				{
					type: 'textinput',
					label: 'Red-Black Value',
					id: 'red_black',
					tooltip: '(0.0-1.0)',
					default: '0.0',
					required: true
				},
				{
					type: 'textinput',
					label: 'Red-Middle Value',
					id: 'red_middle',
					tooltip: '(0.5-1.5)',
					default: '1.0',
					required: true
				},
				{
					type: 'textinput',
					label: 'Red-White Value',
					id: 'red_white',
					tooltip: '(0.0-1.0)',
					default: '1.0',
					required: true
				},
				{
					type: 'textinput',
					label: 'Green-Black Value',
					id: 'green_black',
					tooltip: '(0.0-1.0)',
					default: '0.0',
					required: true
				},
				{
					type: 'textinput',
					label: 'Green-Middle Value',
					id: 'green_middle',
					tooltip: '(0.5-1.5)',
					default: '1.0',
					required: true
				},
				{
					type: 'textinput',
					label: 'Green-White Value',
					id: 'green_white',
					tooltip: '(0.0-1.0)',
					default: '0.9',
					required: true
				},
				{
					type: 'textinput',
					label: 'Blue-Black Value',
					id: 'blue_black',
					tooltip: '(0.0-1.0)',
					default: '0',
					required: true
				},
				{
					type: 'textinput',
					label: 'Blue-Middle Value',
					id: 'blue_middle',
					tooltip: '(0.5-1.5)',
					default: '1.0',
					required: true
				},
				{
					type: 'textinput',
					label: 'Blue-White Value',
					id: 'blue_white',
					tooltip: '(0.0-1.0)',
					default: '0.8',
					required: true
				},
				{
					type: 'dropdown',
					label: 'Calibration Patterns',
					id: 'calibration_patterns',
					default: 'transparent',
					choices: self.CHOICES_CALIBRATION_PATTERNS
				}
			]
		},
		'lumenance_increase': {
			label: 'Increase White Point Lumenance By 10%',
			options: [
				{
					type: 'dropdown',
					label: 'Screen',
					id: 'screen',
					choices: self.CHOICES_SCREENS
				},
				{
					type: 'dropdown',
					label: 'Calibration Patterns',
					id: 'calibration_patterns',
					default: 'transparent',
					choices: self.CHOICES_CALIBRATION_PATTERNS
				}
			]
		},
		'lumenance_decrease': {
			label: 'Decrease White Point Lumenance By 10%',
			options: [
				{
					type: 'dropdown',
					label: 'Screen',
					id: 'screen',
					choices: self.CHOICES_SCREENS
				},
				{
					type: 'dropdown',
					label: 'Calibration Patterns',
					id: 'calibration_patterns',
					default: 'transparent',
					choices: self.CHOICES_CALIBRATION_PATTERNS
				}
			]
		}
	});
};

instance.prototype.action = function(action) {

	let self = this;
	let cmd;
	let options = action.options;

	let screenStateObj = {};

	let screen;
	
	switch(action.action) {
		case 'set_values':
			if (options.screen === null) {
				options.screen = self.CHOICES_SCREENS[0].id;
			}
		
			if (options.blending_mode === null) {
				options.blending_mode = self.CHOICES_BLENDING_MODES[0].id;
			}
		
			if (options.calibration_patterns === null) {
				options.calibration_patterns = self.CHOICES_CALIBRATION_PATTERNS[0].id;
			}
		
			screenStateObj = {};
			screenStateObj.gamma = [
					parseInt(options.blending_mode),
					parseFloat(options.master_black), parseFloat(options.master_middle), parseFloat(options.master_white),
					parseFloat(options.red_black), parseFloat(options.red_middle), parseFloat(options.red_white),
					parseFloat(options.green_black), parseFloat(options.green_middle), parseFloat(options.green_white),
					parseFloat(options.blue_black), parseFloat(options.blue_middle), parseFloat(options.blue_white),
				];
			screenStateObj.content = options.calibration_patterns;

			cmd = 'state-update { "' + options.screen + '":' + JSON.stringify(screenStateObj) + '}';
			break;
		case 'lumenance_increase':
			if (options.screen === null) {
				options.screen = self.CHOICES_SCREENS[0].id;
			}

			if (options.calibration_patterns === null) {
				options.calibration_patterns = self.CHOICES_CALIBRATION_PATTERNS[0].id;
			}

			screen = self.screens.find( ({ screenId }) => screenId === options.screen);
			screenStateObj = {};
			screenStateObj.gamma = screen.gamma;
			screenStateObj.gamma[3] = (((screenStateObj.gamma[3] * 100) + 10) / 100);
			if (screenStateObj.gamma[3] > 1) {
				screenStateObj.gamma[3] = 1;
			}
			screenStateObj.content = options.calibration_patterns;

			cmd = 'state-update { "' + options.screen + '":' + JSON.stringify(screenStateObj) + '}';
			break;
		case 'lumenance_decrease':
			if (options.screen === null) {
				options.screen = self.CHOICES_SCREENS[0].id;
			}

			if (options.calibration_patterns === null) {
				options.calibration_patterns = self.CHOICES_CALIBRATION_PATTERNS[0].id;
			}

			screen = self.screens.find( ({ screenId }) => screenId === options.screen);
			screenStateObj = {};
			screenStateObj.gamma = screen.gamma;
			screenStateObj.gamma[3] = (((screenStateObj.gamma[3] * 100) - 10) / 100);
			screenStateObj.content = options.calibration_patterns;
			if (screenStateObj.gamma[3] < 0) {
				screenStateObj.gamma[3] = 0;
			}
			cmd = 'state-update { "' + options.screen + '":' + JSON.stringify(screenStateObj) + '}';
			break;
	}

	if (cmd !== undefined) {
		if (self.udp !== undefined ) {
			cmd = 'Gmaestro ' + cmd;
			console.log(cmd);
			//debug('sending',cmd,"to",self.config.host);

			self.udp.send(Buffer.from(cmd));
		}
	}
};

instance.prototype.processFeedback = function(data) {
	let self = this;

	if (data.indexOf('Gmaestro ann ') > -1) {
		let obj = data.toString().substring(13);
		let objJson = JSON.parse(obj);

		let objScreens = Object.entries(objJson.screens);

		self.screens = [];
		self.CHOICES_SCREENS = [];

		for (let i = 0; i < objScreens.length; i++) {
			let labelScreenObj = {};
			labelScreenObj.id = objScreens[i][0];
			labelScreenObj.label = objJson.name + ' ' + objScreens[i][1].number;
			self.CHOICES_SCREENS.push(labelScreenObj);

			let screenObj = {};
			screenObj.screenId = objScreens[i][0];
			screenObj.gamma = objScreens[i][1].gamma;
			self.screens.push(screenObj);
		}

		self.actions();
	}
};

instance_skel.extendedBy(instance);
exports = module.exports = instance;
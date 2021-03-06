// Gamma Control Gmaestro

var udp = require('../../udp');
var dgram = require('dgram');
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

instance.prototype.TIMER = null;

instance.prototype.updateConfig = function(config) {
	let self = this;

	self.config = config;

	self.screens = [];
	self.CHOICES_SCREENS = [];

	self.init_udp();
	self.init_timer();
};

instance.prototype.init = function() {
	let self = this;

	debug = self.debug;
	log = self.log;

	self.screens = [];
	self.CHOICES_SCREENS = [];

	self.init_udp();
	self.init_timer();
};

instance.prototype.init_udp = function() {
	let self = this;

	self.destroy();

	self.status(self.STATE_WARNING, 'Connecting');

	self.screens = [];
	self.CHOICES_SCREENS = [];

	if (self.config.broadcast) {
		self.udp = dgram.createSocket("udp4");
		let cmd = 'Gmaestro sub ';
		self.udp.bind();

		self.udp.on('listening', function() {			
			self.udp.setBroadcast(true);
			self.udp.send(cmd, 0, cmd.length, 44188, self.config.host);
		});

		self.udp.on('error', function (err) {
			debug("Network error", err);
			self.status(self.STATE_ERROR, err);
			self.log('error',"Network error: " + err.message);
		});

		self.udp.on('message', function (msg, rinfo) {
			self.status(self.STATE_OK);
			self.processFeedback(msg.toString(), rinfo.address);
		});

		self.udp.on('status_change', function (status, message) {
			self.status(status, message);
		});
	}
	else {
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
				self.processFeedback(data.toString(), self.config.host);
			});

			self.udp.on('status_change', function (status, message) {
				self.status(status, message);
			});
		}
	}
};

instance.prototype.init_timer = function() {
	let self = this;

	if (self.TIMER !== null) {
		clearInterval(self.TIMER);
		self.TIMER = null;
	}

	if (self.config.polling_rate > 0) {
		self.TIMER = setInterval(self.checkForData.bind(self), self.config.polling_rate);
	}
};

instance.prototype.checkForData = function() {
	let self = this;

	let cmd = 'Gmaestro sub ';

	if (self.config.broadcast) {
		self.udp.send(cmd, 0, cmd.length, 44188, self.config.host);
	}
	else {
		if (self.config.host) {
			self.udp.send(cmd); //send to individual host defined in module config
		}
	}
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
			value: 'This module will connect to Gamma Control software.'
		},
		{
			type: 'textinput',
			id: 'host',
			label: 'IP Address',
			width: 6,
			default: '192.168.0.1',
			regex: self.REGEX_IP
		},
		{
			type: 'checkbox',
			label: 'Use UDP Broadcast',
			id: 'broadcast',
			default: false,
			tooltip: 'If selected, the module will send UDP broadcast to the entire subnet based on the IP address entered, in order to build a list of screens.'
		},
		{
			type: 'number',
			id: 'polling_rate',
			label: 'Data Polling Rate',
			tooltip: 'The rate in milliseconds at which data should be polled for changes outside of the module. Set to 0 (zero) to disable.',
			default: '1000',
			required: true,
			regex: self.NUMBER
		}
	]
};

// When module gets deleted
instance.prototype.destroy = function() {
	let self = this;

	if (self.udp !== undefined) {
		if (self.config.broadcast) {
			try {
				self.udp.socket.removeAllListeners();
				self.udp.close();
			}
			catch (error) {

			}
			finally {
				self.udp = null;
			}
		}
		else {
			self.udp.destroy();
			self.udp = null;
		}
	}

	if (self.TIMER !== null) {
		clearInterval(self.TIMER);
		self.TIMER = null;
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
		'increase_master_black': {
			label: 'Increase Master Black Point Luminance By %',
			options: [
				{
					type: 'dropdown',
					label: 'Screen',
					id: 'screen',
					choices: self.CHOICES_SCREENS
				},
				{
					type: 'number',
					label: 'Percentage',
					id: 'percentage',
					min: 1,
					max: 25,
					default: 1,
					required: true,
					range: false
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
		'decrease_master_black': {
			label: 'Decrease Master Black Point Luminance By %',
			options: [
				{
					type: 'dropdown',
					label: 'Screen',
					id: 'screen',
					choices: self.CHOICES_SCREENS
				},
				{
					type: 'number',
					label: 'Percentage',
					id: 'percentage',
					min: 1,
					max: 25,
					default: 1,
					required: true,
					range: false
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
		'increase_master_middle': {
			label: 'Increase Master Middle Gray Balance By %',
			options: [
				{
					type: 'dropdown',
					label: 'Screen',
					id: 'screen',
					choices: self.CHOICES_SCREENS
				},
				{
					type: 'number',
					label: 'Percentage',
					id: 'percentage',
					min: 1,
					max: 25,
					default: 1,
					required: true,
					range: false
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
		'decrease_master_middle': {
			label: 'Decrease Master Middle Gray Balance By %',
			options: [
				{
					type: 'dropdown',
					label: 'Screen',
					id: 'screen',
					choices: self.CHOICES_SCREENS
				},
				{
					type: 'number',
					label: 'Percentage',
					id: 'percentage',
					min: 1,
					max: 25,
					default: 1,
					required: true,
					range: false
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
		'increase_master_white': {
			label: 'Increase Master White Point Luminance By %',
			options: [
				{
					type: 'dropdown',
					label: 'Screen',
					id: 'screen',
					choices: self.CHOICES_SCREENS
				},
				{
					type: 'number',
					label: 'Percentage',
					id: 'percentage',
					min: 1,
					max: 25,
					default: 1,
					required: true,
					range: false
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
		'decrease_master_white': {
			label: 'Decrease Master White Point Luminance By %',
			options: [
				{
					type: 'dropdown',
					label: 'Screen',
					id: 'screen',
					choices: self.CHOICES_SCREENS
				},
				{
					type: 'number',
					label: 'Percentage',
					id: 'percentage',
					min: 1,
					max: 25,
					default: 1,
					required: true,
					range: false
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
		'increase_red_black': {
			label: 'Increase Red Black By %',
			options: [
				{
					type: 'dropdown',
					label: 'Screen',
					id: 'screen',
					choices: self.CHOICES_SCREENS
				},
				{
					type: 'number',
					label: 'Percentage',
					id: 'percentage',
					min: 1,
					max: 25,
					default: 1,
					required: true,
					range: false
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
		'decrease_red_black': {
			label: 'Decrease Red Black By %',
			options: [
				{
					type: 'dropdown',
					label: 'Screen',
					id: 'screen',
					choices: self.CHOICES_SCREENS
				},
				{
					type: 'number',
					label: 'Percentage',
					id: 'percentage',
					min: 1,
					max: 25,
					default: 1,
					required: true,
					range: false
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
		'increase_red_middle': {
			label: 'Increase Red Middle By %',
			options: [
				{
					type: 'dropdown',
					label: 'Screen',
					id: 'screen',
					choices: self.CHOICES_SCREENS
				},
				{
					type: 'number',
					label: 'Percentage',
					id: 'percentage',
					min: 1,
					max: 25,
					default: 1,
					required: true,
					range: false
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
		'decrease_red_middle': {
			label: 'Decrease Red Middle By %',
			options: [
				{
					type: 'dropdown',
					label: 'Screen',
					id: 'screen',
					choices: self.CHOICES_SCREENS
				},
				{
					type: 'number',
					label: 'Percentage',
					id: 'percentage',
					min: 1,
					max: 25,
					default: 1,
					required: true,
					range: false
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
		'increase_red_white': {
			label: 'Increase Red White By %',
			options: [
				{
					type: 'dropdown',
					label: 'Screen',
					id: 'screen',
					choices: self.CHOICES_SCREENS
				},
				{
					type: 'number',
					label: 'Percentage',
					id: 'percentage',
					min: 1,
					max: 25,
					default: 1,
					required: true,
					range: false
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
		'decrease_red_white': {
			label: 'Decrease Red White By %',
			options: [
				{
					type: 'dropdown',
					label: 'Screen',
					id: 'screen',
					choices: self.CHOICES_SCREENS
				},
				{
					type: 'number',
					label: 'Percentage',
					id: 'percentage',
					min: 1,
					max: 25,
					default: 1,
					required: true,
					range: false
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
		'increase_green_black': {
			label: 'Increase Green Black By %',
			options: [
				{
					type: 'dropdown',
					label: 'Screen',
					id: 'screen',
					choices: self.CHOICES_SCREENS
				},
				{
					type: 'number',
					label: 'Percentage',
					id: 'percentage',
					min: 1,
					max: 25,
					default: 1,
					required: true,
					range: false
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
		'decrease_green_black': {
			label: 'Decrease Green Black By %',
			options: [
				{
					type: 'dropdown',
					label: 'Screen',
					id: 'screen',
					choices: self.CHOICES_SCREENS
				},
				{
					type: 'number',
					label: 'Percentage',
					id: 'percentage',
					min: 1,
					max: 25,
					default: 1,
					required: true,
					range: false
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
		'increase_green_middle': {
			label: 'Increase Green Middle By %',
			options: [
				{
					type: 'dropdown',
					label: 'Screen',
					id: 'screen',
					choices: self.CHOICES_SCREENS
				},
				{
					type: 'number',
					label: 'Percentage',
					id: 'percentage',
					min: 1,
					max: 25,
					default: 1,
					required: true,
					range: false
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
		'decrease_green_middle': {
			label: 'Decrease Green Middle By %',
			options: [
				{
					type: 'dropdown',
					label: 'Screen',
					id: 'screen',
					choices: self.CHOICES_SCREENS
				},
				{
					type: 'number',
					label: 'Percentage',
					id: 'percentage',
					min: 1,
					max: 25,
					default: 1,
					required: true,
					range: false
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
		'increase_green_white': {
			label: 'Increase Green White By %',
			options: [
				{
					type: 'dropdown',
					label: 'Screen',
					id: 'screen',
					choices: self.CHOICES_SCREENS
				},
				{
					type: 'number',
					label: 'Percentage',
					id: 'percentage',
					min: 1,
					max: 25,
					default: 1,
					required: true,
					range: false
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
		'decrease_green_white': {
			label: 'Decrease Green White By %',
			options: [
				{
					type: 'dropdown',
					label: 'Screen',
					id: 'screen',
					choices: self.CHOICES_SCREENS
				},
				{
					type: 'number',
					label: 'Percentage',
					id: 'percentage',
					min: 1,
					max: 25,
					default: 1,
					required: true,
					range: false
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
		'increase_blue_black': {
			label: 'Increase Blue Black By %',
			options: [
				{
					type: 'dropdown',
					label: 'Screen',
					id: 'screen',
					choices: self.CHOICES_SCREENS
				},
				{
					type: 'number',
					label: 'Percentage',
					id: 'percentage',
					min: 1,
					max: 25,
					default: 1,
					required: true,
					range: false
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
		'decrease_blue_black': {
			label: 'Decrease Blue Black By %',
			options: [
				{
					type: 'dropdown',
					label: 'Screen',
					id: 'screen',
					choices: self.CHOICES_SCREENS
				},
				{
					type: 'number',
					label: 'Percentage',
					id: 'percentage',
					min: 1,
					max: 25,
					default: 1,
					required: true,
					range: false
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
		'increase_blue_middle': {
			label: 'Increase Blue Middle By %',
			options: [
				{
					type: 'dropdown',
					label: 'Screen',
					id: 'screen',
					choices: self.CHOICES_SCREENS
				},
				{
					type: 'number',
					label: 'Percentage',
					id: 'percentage',
					min: 1,
					max: 25,
					default: 1,
					required: true,
					range: false
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
		'decrease_blue_middle': {
			label: 'Decrease Blue Middle By %',
			options: [
				{
					type: 'dropdown',
					label: 'Screen',
					id: 'screen',
					choices: self.CHOICES_SCREENS
				},
				{
					type: 'number',
					label: 'Percentage',
					id: 'percentage',
					min: 1,
					max: 25,
					default: 1,
					required: true,
					range: false
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
		'increase_blue_white': {
			label: 'Increase Blue White By %',
			options: [
				{
					type: 'dropdown',
					label: 'Screen',
					id: 'screen',
					choices: self.CHOICES_SCREENS
				},
				{
					type: 'number',
					label: 'Percentage',
					id: 'percentage',
					min: 1,
					max: 25,
					default: 1,
					required: true,
					range: false
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
		'decrease_blue_white': {
			label: 'Decrease Blue White By %',
			options: [
				{
					type: 'dropdown',
					label: 'Screen',
					id: 'screen',
					choices: self.CHOICES_SCREENS
				},
				{
					type: 'number',
					label: 'Percentage',
					id: 'percentage',
					min: 1,
					max: 25,
					default: 1,
					required: true,
					range: false
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

	if (action.action === 'set_values') {
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
	}
	else {
		if (options.screen === null) {
			options.screen = self.CHOICES_SCREENS[0].id;
		}

		if (options.calibration_patterns === null) {
			options.calibration_patterns = self.CHOICES_CALIBRATION_PATTERNS[0].id;
		}

		screen = self.screens.find( ({ screenId }) => screenId === options.screen);

		screenStateObj = {};
		screenStateObj.gamma = screen.gamma;

		let percentage = parseInt(options.percentage);

		let index = 0;

		switch(action.action) {
			case 'increase_master_black':
			case 'decrease_master_black':
				index = 1;
				break;
			case 'increase_master_middle':
			case 'decrease_master_middle':
				index = 2;
				break;
			case 'increase_master_white':
			case 'decrease_master_white':
				index = 3;
				break;
			case 'increase_red_black':
			case 'decrease_red_black':
				index = 4;
				break;
			case 'increase_red_middle':
			case 'decrease_red_middle':
				index = 5;
				break;
			case 'increase_red_white':
			case 'decrease_red_white':
				index = 6;
				break;
			case 'increase_green_black':
			case 'decrease_green_black':
				index = 7;
				break;
			case 'increase_green_middle':
			case 'decrease_green_middle':
				index = 8;
				break;
			case 'increase_green_white':
			case 'decrease_green_white':
				index = 9;
				break;
			case 'increase_blue_black':
			case 'decrease_blue_black':
				index = 10;
				break;
			case 'increase_blue_middle':
			case 'decrease_blue_middle':
				index = 11;
				break;
			case 'increase_blue_white':
			case 'decrease_blue_white':
				index = 12;
				break;
		}

		if (index > 0) {
			if (action.action.indexOf('increase_') > -1) {
				screenStateObj.gamma[index] = (((screenStateObj.gamma[index] * 100) + percentage) / 100);
			}
			else if (action.action.indexOf('decrease_') > -1) {
				screenStateObj.gamma[index] = (((screenStateObj.gamma[index] * 100) - percentage) / 100);
			}

			if (action.action.indexOf('_middle') > -1) {
				//the middle values can range from 0.5 to 1.5
				if (screenStateObj.gamma[index] > 1.5) {
					screenStateObj.gamma[index] = 1.5;
				}
				else if (screenStateObj.gamma[index] < 0.5) {
					screenStateObj.gamma[index] = 0.5;
				}
			}
			else {
				//the other values can range from 0 to 1
				if (screenStateObj.gamma[index] > 1) {
						screenStateObj.gamma[index] = 1;
				}
				else if (screenStateObj.gamma[index] < 0) {
					screenStateObj.gamma[index] = 0;
				}
			}
		}

		screenStateObj.content = options.calibration_patterns;

		cmd = 'state-update { "' + options.screen + '":' + JSON.stringify(screenStateObj) + '}';
	}

	if (cmd !== undefined) {
		cmd = 'Gmaestro ' + cmd;

		if (self.config.broadcast) {
			let address = null;
			for (let i = 0; i < self.screens.length; i++) {
				if (self.screens[i].screenId === options.screen) {
					address = self.screens[i].address;
				}
			}
			if (address !== null) {
				self.udp.send(cmd, 44188, address);
			}
		}
		else {
			//send to the individual
			if (self.udp !== undefined ) {
				self.udp.send(cmd);
			}
		}
	}
};

instance.prototype.processFeedback = function(data, address) {
	let self = this;

	if (data.indexOf('Gmaestro ann ') > -1) {
		let obj = data.toString().substring(13);
		let objJson = JSON.parse(obj);

		let objScreens = Object.entries(objJson.screens);

		let addedScreen = false;

		for (let i = 0; i < objScreens.length; i++) {
			//loop through the existing screens array and if it does not exist, add it
			let found = false;
			for (let j = 0; j < self.screens.length; j++) {
				if (self.screens[j].screenId === objScreens[i][0]) {
					found = true;
				}
			}

			if (!found) {
				let labelScreenObj = {};
				labelScreenObj.id = objScreens[i][0];
				labelScreenObj.label = objJson.name + ' ' + objScreens[i][1].number;
				self.CHOICES_SCREENS.push(labelScreenObj);
	
				let screenObj = {};
				screenObj.address = address;
				screenObj.screenId = objScreens[i][0];
				screenObj.gamma = objScreens[i][1].gamma;
				self.screens.push(screenObj);

				addedScreen = true;
			}
		}

		if (addedScreen) { //if we added to the CHOICES array, we need to update the actions list, but, we don't want to just do this every time unless something was added
			self.actions();
		}
	}
};

instance_skel.extendedBy(instance);
exports = module.exports = instance;
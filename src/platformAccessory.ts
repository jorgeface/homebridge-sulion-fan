import type { Characteristic, CharacteristicValue, PlatformAccessory, Service, Logging } from 'homebridge';

import type { HomebridgeSulionFanPlatform } from './platform.js';
import TuyAPI from 'tuyapi';
import type TuyaDevice from 'tuyapi';

/**
 * Sulion Fan Accessory
 * An instance of this class is created for each accessory your platform registers
 * Each accessory may expose multiple services of different service types.
 */
export class SulionFanAccessory {
  private ledService: Service;
  private fanService: Service;
  private readonly Characteristic: typeof Characteristic;
  private readonly log: Logging;
  private readonly tuyaDevice: TuyaDevice;
  private stateHasChanged = false;
  private ledState = {
    On: false,
    Brightness: 50,
    Temperature: 140,
  };
  private fanState = {
    On: 0 as CharacteristicValue,
    Speed: 25,
    Rotation: 0,
  };
  

  constructor(
    private readonly platform: HomebridgeSulionFanPlatform,
    private readonly accessory: PlatformAccessory,
  ) {

    this.Characteristic = this.platform.Characteristic;
    this.log = this.platform.log;

    this.log.info(`${accessory.displayName}:`, 'Init...');
    
    // set accessory information
    this.accessory.getService(this.platform.Service.AccessoryInformation)!
      .setCharacteristic(this.platform.Characteristic.Manufacturer, 'Sulion')
      .setCharacteristic(this.platform.Characteristic.Model, 'Sulion Fan')
      .setCharacteristic(this.platform.Characteristic.SerialNumber, accessory.context.device.id);
    
    // Fan
    this.fanService = this.accessory.getService(this.platform.Service.Fanv2) || this.accessory.addService(this.platform.Service.Fanv2);
    this.fanService.setCharacteristic(this.Characteristic.Name, accessory.context.device.name);
    this.fanService.getCharacteristic(this.Characteristic.Active)
      .onGet(this.getFanOn.bind(this))
      .onSet(this.setFanOn.bind(this));

    // Fan speed
    this.fanService.getCharacteristic(this.platform.Characteristic.RotationSpeed)
      .onGet(this.getFanSpeed.bind(this))
      .onSet(this.setFanSpeed.bind(this));
    // Fan rotation
    this.fanService.getCharacteristic(this.platform.Characteristic.RotationDirection)   
      .onGet(this.getFanRotation.bind(this))
      .onSet(this.setFanRotation.bind(this));
    
    // Led
    this.ledService = this.accessory.getService(this.platform.Service.Lightbulb) || this.accessory.addService(this.platform.Service.Lightbulb);
    this.ledService.getCharacteristic(this.platform.Characteristic.On)
      .onGet(this.getLedOn.bind(this))
      .onSet(this.setLedOn.bind(this));
    // Brightness
    this.ledService.getCharacteristic(this.platform.Characteristic.Brightness)
      .onGet(this.getLedBrightness.bind(this))
      .onSet(this.setLedBrightness.bind(this));
    /*// Temperature
    this.lightService.getCharacteristic(this.platform.Characteristic.ColorTemperature)
      .onGet(this.getLedTemperature.bind(this))
      .onSet(this.setLedTemperature.bind(this));
    */

    this.tuyaDevice = new TuyAPI({
      id: accessory.context.device.id,
      key: accessory.context.device.key,
      ip: accessory.context.device.ip,
      version: 3.4, 
    });
  
    //let stateHasChanged = false;
  
    // Find device on network
    this.tuyaDevice.find().then(() => {
      // Connect to device
      this.tuyaDevice.connect();
    });

    // Add event listeners
    this.tuyaDevice.on('connected', () => {
      console.log('Connected to device!');
    });

    this.tuyaDevice.on('disconnected', () => {
      console.log('Disconnected from device.');
    });
    
    this.tuyaDevice.on('error', error => {
      console.log('Error!', error);
    });

    /* this.tuyaDevice.on('data', data => {
      console.log('Data from device:', data);
    
      console.log(`Boolean status of default property: ${data.dps['1']}.`);
    
      // Set default property to opposite
      if (!stateHasChanged) {
        this.tuyaDevice.set({set: !(data.dps['1'])});
    
        // Otherwise we'll be stuck in an endless
        // loop of toggling the state.
        stateHasChanged = true;
      }
    });*/

    // Disconnect after 10 seconds
    setTimeout(() => { 
      this.tuyaDevice.disconnect(); 
    }, 10000);

  }

  sendCommand(dps: number, value: string | number | boolean) {
    this.log.debug(`${this.accessory.displayName}:`, `sendCommand(${dps}, ${value})`);
    this.tuyaDevice.set({ dps, set: value });
  }

  getFanOn() {
    this.log.debug(`${this.accessory.displayName}:`, `getFanOn() => ${this.fanState.On === 0 ? 'INACTIVE' : 'ACTIVE'}`);
    return this.fanState.On;
  }

  setFanOn(value: CharacteristicValue) {
    this.fanState.On = this.fanState.On === this.Characteristic.Active.INACTIVE
      ? this.Characteristic.Active.ACTIVE
      : this.Characteristic.Active.INACTIVE;
    if (value !== this.fanState.On) {
      this.fanService.updateCharacteristic(this.Characteristic.Active, this.fanState.On);
    }
    this.sendCommand(60, this.fanState.On === 1);
    this.log.debug(`${this.accessory.displayName}:`, `setFanOn() => ${value === 0 ? 'INACTIVE' : 'ACTIVE'}`);
  }

  getFanSpeed() {
    this.log.debug(`${this.accessory.displayName}:`, `getFanSpeed() => ${this.fanState.Speed}`);
    return this.fanState.Speed;
  }

  setFanSpeed(value: CharacteristicValue) {
    if (value.valueOf() === 0) {
      this.sendCommand(60, false);
    }else{
      this.fanState.Speed = value.valueOf() as number;
      this.sendCommand(62, this.toStep(this.fanState.Speed));
    }
    this.log.debug(`${this.accessory.displayName}:`, `setFanSpeed() => ${this.toStep(this.fanState.Speed)}`);
  }

  getFanRotation() {
    this.log.debug(`${this.accessory.displayName}:`, `getFanRotation() => ${this.fanState.Rotation === 0 ? 'CLOCKWISE' : 'COUNTER_CLOCKWISE'}`);
    return this.fanState.On;
  }

  setFanRotation(value: CharacteristicValue) {
    this.fanState.Rotation = this.fanState.Rotation === this.Characteristic.RotationDirection.CLOCKWISE
      ? this.Characteristic.RotationDirection.CLOCKWISE
      : this.Characteristic.RotationDirection.COUNTER_CLOCKWISE;
    if (value !== this.fanState.Rotation) {
      this.fanService.updateCharacteristic(this.Characteristic.RotationDirection, this.fanState.Rotation);
    }
    this.sendCommand(63, this.fanState.Rotation === 0 ? 'forward' : 'reverse');
    this.log.debug(`${this.accessory.displayName}:`, `setFanRotation() => ${this.fanState.Rotation === 0 ? 'CLOCKWISE' : 'COUNTER_CLOCKWISE'}`);
  }

  getLedOn() {
    this.log.debug(`${this.accessory.displayName}:`, `getLightOn() => ${this.ledState.On ? 'ON' : 'OFF'}`);
    return this.ledState.On;
  }

  setLedOn(value: CharacteristicValue) {
    if (value !== this.ledState.On) {
      this.ledState.On = value as boolean;
      this.sendCommand(20, this.ledState.On);
    }
    this.log.debug(`${this.accessory.displayName}:`, `setLightOn() => ${this.ledState.On ? 'ON' : 'OFF'}`);
  }

  getLedBrightness() {
    this.log.debug(`${this.accessory.displayName}:`, `getLedBrightness() => ${this.ledState.Brightness}`);
    return this.ledState.Brightness;
  }

  setLedBrightness(value: CharacteristicValue) {
    if (value.valueOf() === 0) {
      this.sendCommand(20, false);
    }else{
      this.ledState.Brightness = value.valueOf() as number;
      this.sendCommand(22, this.ledState.Brightness * 10);
    }
    this.log.debug(`${this.accessory.displayName}:`, `setLedBrightness() => ${this.ledState.Brightness}`);
  }

  toStep(percent: number) {
    const etapes = [1, 2, 3, 4, 5, 6];
    const etapeIndex = Math.floor(percent / 16.67); // 100 / 6 = 16.67
    return etapes[etapeIndex];
  }

}
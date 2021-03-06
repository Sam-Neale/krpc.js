import proto from './proto.js';
import { decodeReturn } from './decoders.js';
import { encodeArgument } from './encoders.js';
import { camelCase } from 'lodash-es';

const Instances = [];

function buildProcedureCall(service, procedure, args) {
    args = args.map((arg, i)=>{
        return proto.Argument.create({position: i, value: arg});
    });
    return proto.ProcedureCall.create({service, procedure, arguments: args});
}

export default class Service {
    static getService(name) {
        return Instances[name];
    }
    static getException(service, name) {
        return Service.getService(service).exceptions[name];
    }
    static getEnum(service, name) {
        return Service.getService(service).enums[name];
    }
    static getClass(service, name) {
        return Service.getService(service).classes[name];
    }
    static getCall(service, name) {
        return Service.getService(service).calls[name];
    }
    static getProcedure(service, name) {
        return Service.getService(service).procedures[name];
    }
    constructor(serviceObj, sendCall, streamCall, streamEvent) {
        this.name = serviceObj.name;
        this.documentation = serviceObj.documentation;
        this._sendCall = sendCall;
        this._streamCall = streamCall;
        this._streamEvent = streamEvent;
        this._streamCache = {};
        Instances[this.name] = this;
        this.exceptions = {};
        serviceObj.exceptions.forEach((exceptionObj)=>this._addException(exceptionObj));
        this.enums = {};
        serviceObj.enumerations.forEach((enumObj)=>this._addEnum(enumObj));
        this.classes = {};
        serviceObj.classes.forEach((classObj)=>this._addClass(classObj));
        this.calls = {};
        this.procedures = {};
        serviceObj.procedures.forEach((procedureObj)=>this._addProcedure(procedureObj));

        Object.values(this.classes).forEach((cls)=>this._addClassProperties(cls));
        this._addServiceProperties();
    }
    stream(name, onChange) {
        // create stream and update _streamCache on change. call the onChange observer as well
        let call = this._streams[name](this);
        return this._streamCall(call, (v)=>{
            this._streamCache[name] = v;
            if (typeof onChange === 'function') {
                onChange(v);
            }
        }, ()=>{
            delete this._streamCache[name];
        });
    }
    _addProperties(obj, functions, getter, setter) {
        let methodes = {};
        functions.forEach((call)=>{
            let name = call.split('_').pop();
            methodes[name] = call;
        });
        let attributes = {};
        getter.forEach((call)=>{
            let name = call.split('_').pop();
            attributes[name] = attributes[name]||{};
            attributes[name].get = call;
        });
        setter.forEach((call)=>{
            let name = call.split('_').pop();
            attributes[name] = attributes[name]||{};
            attributes[name].set = call;
        });

        Object.keys(methodes).forEach((name)=>{
            let callname = methodes[name];
            let fn = this.procedures[callname];
            // IDEA: check how functions could be streamable
            // obj._streams[camelCase(name)] = this.calls[callname];
            obj[camelCase(name)] = async function(...args) {
                if(this instanceof Service) {
                    return fn(...args);
                }
                return await fn(this, ...args);
            };
        });

        Object.keys(attributes).forEach((name)=>{
            let {get, set} = attributes[name];
            let handler = {};
            if (get) {
                let g = this.procedures[get];
                obj._streams[camelCase(name)] = this.calls[get];
                handler.get = function() {
                    if(typeof this._streamCache[camelCase(name)] !== "undefined") {
                        return Promise.resolve(this._streamCache[camelCase(name)]);
                    }
                    if(this instanceof Service) {
                        return g();
                    }
                    return g(this);
                };
            }
            if (set) {
                let s = this.procedures[set];
                handler.set = function(value) {
                    if(this instanceof Service) {
                        return s(value);
                    }
                    return s(this, value);
                };
            }

            Object.defineProperty(obj, camelCase(name), handler);
        });
    }
    _addStatics(obj, statics) {
        let methodes = {};
        statics.forEach((call)=>{
            let name = call.split('_').pop();
            methodes[name] = call;
        });

        Object.keys(methodes).forEach((name)=>{
            let callname = methodes[name];
            let fn = this.procedures[callname];
            // IDEA: check how statics could be streamable
            // obj._streams[name] = this.calls[callname];
            obj[name] = function(...args) {
                if(this instanceof Service) {
                    return fn(...args);
                }
                return fn(...args);
            };
        });
    }

    _addClass(classObj) {
        let _streamCall = this._streamCall;
        this.classes[classObj.name] = class Class {
            constructor(id) {
                if (Class.Instances[id]) {return Class.Instances[id];}
                Class.Instances[id] = this;

                this.id = id;
                // this.uid = Math.random().toFixed(10).slice(2);
                this.className = Class.Name;
                this.classDocumentation = Class.Documentation;
                this._streamCache = {};
            }
            stream(name, onChange) {
                // create stream and update _streamCache on change. call the onChange observer as well
                let call = this._streams[name](this);
                return _streamCall(call, (v)=>{
                    this._streamCache[name] = v;
                    if (typeof onChange === 'function') {
                        onChange(v);
                    }
                }, ()=>{
                    delete this._streamCache[name];
                });
            }
        };
        this.classes[classObj.name].Name = classObj.name;
        this.classes[classObj.name].Documentation = classObj.documentation;
        this.classes[classObj.name].Instances = [];
        this[classObj.name] = this.classes[classObj.name];
    }
    _addClassProperties(cls) {
        let functions = Object.keys(this.procedures).filter((call)=>call.indexOf(cls.Name) === 0 && call.indexOf('_get_') === -1 && call.indexOf('_set_') === -1 && call.indexOf('_static_') === -1);
        let getter = Object.keys(this.procedures).filter((call)=>call.indexOf(cls.Name+'_get_') === 0);
        let setter = Object.keys(this.procedures).filter((call)=>call.indexOf(cls.Name+'_set_') === 0);
        let statics = Object.keys(this.procedures).filter((call)=>call.indexOf(cls.Name+'_static_') === 0);

        cls.prototype._streams = {};
        this._addProperties(cls.prototype, functions, getter, setter);
        this._addStatics(cls, statics);
    }
    _addServiceProperties() {
        let functions = Object.keys(this.procedures).filter((call)=>call.indexOf('_') === -1);
        let getter = Object.keys(this.procedures).filter((call)=>call.indexOf('get_') === 0);
        let setter = Object.keys(this.procedures).filter((call)=>call.indexOf('set_') === 0);

        this._streams = {};
        this._addProperties(this, functions, getter, setter);
    }
    _addEnum(enumObj) {
        let names = {};
        let values = {};
        let enm = {};
        let documentations = {};
        enumObj.values.forEach((value, i)=>{
            if(typeof value.value !== 'undefined') {
                names[value.name] = value.value;
                values[value.value] = value.name;
                enm[value.name] = value.value;
            } else {
                names[value.name] = i;
                values[i] = value.name;
                enm[value.name] = i;
            }
            documentations[value.name] = value.documentation;
        });
        enm.names = names;
        enm.values = values;
        enm.documentations = documentations;

        enm.name = enumObj.name;
        enm.documentation = enumObj.documentation;

        this.enums[enumObj.name] = enm;
        this[enumObj.name] = enm;
    }
    _addException(exceptionObj) {
        this.exceptions[exceptionObj.name] = function() {
            this.name = exceptionObj.name;
            this.message = exceptionObj.documentation;
        };
        this.exceptions[exceptionObj.name].prototype = Error.prototype;
        this[exceptionObj.name] = this.exceptions[exceptionObj.name];
    }
    _addProcedure(procedureObj) {
        this.calls[procedureObj.name] = (...args)=>{
            // console.log('Arguments:',args);
            let encodedArguments = [];
            procedureObj.parameters.forEach((param, i)=>{
                encodedArguments[i] = encodeArgument(args[i], param, Service);
            });
            // console.log('encodedArguments:',encodedArguments);
            return {
                call: buildProcedureCall(this.name, procedureObj.name, encodedArguments),
                decode: (value)=>decodeReturn(value, procedureObj.returnType, Service)
            };
        };
        this.procedures[procedureObj.name] = (...args)=>{
            return this._sendCall(this.calls[procedureObj.name](...args)).then(res=>{
              if (res.error || res.results[0].error) {
                  throw res.error || res.results[0].error;
              }
              return res.results[0].value;
            });
        };
        this.procedures[procedureObj.name].documentation = procedureObj.documentation;
    }
}

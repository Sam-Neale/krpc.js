'use strict';
let proto = require('./proto');
const decoders = require('./decoders');
const encoders = require('./encoders');

function buildProcedureCall(service, procedure, args) {
    args = args.map((arg, i)=>{
        return proto.Argument.create({position: i, value: arg});
    });
    return proto.ProcedureCall.create({service, procedure, arguments: args});
}

/**
 * @constructor KRPC
 * @name KRPC
 * @description Main kRPC service, used by clients to interact with basic server functionality.
 * @result {void}
 * @returns {void}
 */


/**
 * @augments KRPC
 * @description Returns the identifier for the current client.
 * @result {bytes}
 * @returns {{call :Object, decode: function}}
 */
module.exports.getClientId = function getClientId() {
    let encodedArguments = [];
    return {
        call: buildProcedureCall('KRPC', 'GetClientID', encodedArguments),
        decode: (value)=>decoders.bytes(value)
    };
};

/**
 * @augments KRPC
 * @description Returns some information about the server, such as the version.
 * @result {Object}
 * @returns {{call :Object, decode: function}}
 */
module.exports.getStatus = function getStatus() {
    let encodedArguments = [];
    return {
        call: buildProcedureCall('KRPC', 'GetStatus', encodedArguments),
        decode: (value)=>proto.Status.decode(value)
    };
};

/**
 * @augments KRPC
 * @description Returns information on all services, procedures, classes, properties etc. provided by the server.
 * Can be used by client libraries to automatically create functionality such as stubs.
 * @result {Object}
 * @returns {{call :Object, decode: function}}
 */
module.exports.getServices = function getServices() {
    let encodedArguments = [];
    return {
        call: buildProcedureCall('KRPC', 'GetServices', encodedArguments),
        decode: (value)=>proto.Services.decode(value)
    };
};

/**
 * @augments KRPC
 * @description Add a streaming request and return its identifier.
 * @param {Object} call
 * @result {Object}
 * @returns {{call :Object, decode: function}}
 */
module.exports.addStream = function addStream(call) {
    let encodedArguments = [
        {buffer: proto.ProcedureCall.encode(call).finish()}
    ];
    return {
        call: buildProcedureCall('KRPC', 'AddStream', encodedArguments),
        decode: (value)=>proto.Stream.decode(value)
    };
};

/**
 * @augments KRPC
 * @description Remove a streaming request.
 * @param {number} id
 * @result {void}
 * @returns {void}
 */
module.exports.removeStream = function removeStream(id) {
    let encodedArguments = [
        encoders.uInt64(id)
    ];
    return {
        call: buildProcedureCall('KRPC', 'RemoveStream', encodedArguments),
        decode: null
    };
};

/**
 * @augments KRPC
 * @description A list of RPC clients that are currently connected to the server.
 * Each entry in the list is a clients identifier, name and address.
 * @result {{bytes, string, string}[]}
 * @returns {{call :Object, decode: function}}
 */
module.exports.getClients = function getClients() {
    let encodedArguments = [];
    return {
        call: buildProcedureCall('KRPC', 'get_Clients', encodedArguments),
        decode: (value)=>{
            let list = proto.List.decode(value).items;
            let items = list.map((tuple)=>{
                tuple = proto.Tuple.decode(tuple).items;
                tuple[0] = decoders.bytes(tuple[0]);
                tuple[1] = decoders.string(tuple[1]);
                tuple[2] = decoders.string(tuple[2]);
                return tuple;
            });
            return items;
        }
    };
};

/**
 * @augments KRPC
 * @description Get the current game scene.
 * @result {Long} A long value representing the id for the KRPC.GameScene
 * @returns {{call :Object, decode: function}}
 */
module.exports.getCurrentGameScene = function getCurrentGameScene() {
    let encodedArguments = [];
    return {
        call: buildProcedureCall('KRPC', 'get_CurrentGameScene', encodedArguments),
        decode: (value)=>{
            let values = {
                0: 'SpaceCenter',
                1: 'Flight',
                2: 'TrackingStation',
                3: 'EditorVAB',
                4: 'EditorSPH'
            };
            value = decoders.sInt32(value);
            return values[value];
        }
    };
};

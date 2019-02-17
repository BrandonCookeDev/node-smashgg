"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
var events_1 = require("events");
var Logger_1 = __importDefault(require("./Logger"));
var GQLClient_1 = __importDefault(require("./GQLClient"));
var DELINQUENCY_TIMER = 60000;
var DELINQUENCY_RATE = 60;
var SEMAPHORE_TIMER = 500;
var DelinquencyQueue = /** @class */ (function (_super) {
    __extends(DelinquencyQueue, _super);
    function DelinquencyQueue(count, delinquencyQueue) {
        var _this_1 = _super.call(this) || this;
        _this_1.count = 0;
        _this_1.delinquencyQueue = [];
        _this_1.count = count;
        _this_1.delinquencyQueue = delinquencyQueue;
        return _this_1;
    }
    DelinquencyQueue.getInstance = function () {
        if (!DelinquencyQueue.instance) {
            DelinquencyQueue.instance = new DelinquencyQueue(0, []);
            DelinquencyQueue.queuingSemaphore = null;
            DelinquencyQueue.executionSemaphore = null;
            DelinquencyQueue.inspector = null;
            // listen and fire if an addition puts the queue at capacity
            DelinquencyQueue.instance.on('add', function () {
                if (DelinquencyQueue.instance.count >= DELINQUENCY_RATE) {
                    DelinquencyQueue.instance.queueIsFull();
                }
                DelinquencyQueue.instance.startInspector();
            });
            DelinquencyQueue.instance.startLogTimer(); //debug
        }
        return DelinquencyQueue.instance;
    };
    // semaphore management
    DelinquencyQueue.getExecutionSemaphore = function () {
        return new Promise(function (resolve, reject) {
            if (!DelinquencyQueue.executionSemaphore) {
                DelinquencyQueue.executionSemaphore = {};
                Logger_1.default.verbose('obtaining execution semaphore');
                return resolve(DelinquencyQueue.executionSemaphore);
            }
            else
                return null;
        });
    };
    DelinquencyQueue.releaseExecutionSemaphore = function () {
        Logger_1.default.verbose('releasing execution semaphore');
        if (DelinquencyQueue.executionSemaphore)
            DelinquencyQueue.executionSemaphore = null;
    };
    DelinquencyQueue.getQueuingSemaphore = function () {
        return new Promise(function (resolve, reject) {
            if (!DelinquencyQueue.queuingSemaphore) {
                DelinquencyQueue.queuingSemaphore = {};
                Logger_1.default.verbose('obtaining queuing semaphore');
                return resolve(DelinquencyQueue.queuingSemaphore);
            }
            else
                return null;
        });
    };
    DelinquencyQueue.releaseQueuingSemaphore = function () {
        Logger_1.default.verbose('releasing queuing semaphore');
        if (DelinquencyQueue.queuingSemaphore)
            DelinquencyQueue.queuingSemaphore = null;
    };
    // instance
    DelinquencyQueue.prototype.executeQuery = function (query, variables) {
        var _this = this;
        return new Promise(function (resolve, reject) {
            // fire event and increment counter
            _this.addedToQueue();
            // set a timer to remove count after delinquency timer
            setTimeout(function () {
                _this.removedFromQueue();
            }, DELINQUENCY_TIMER);
            // obtain the global semaphore
            var semaphoreInterval = setInterval(function () {
                DelinquencyQueue.getExecutionSemaphore()
                    .then(function (semaphore) {
                    // if the semaphore was obtained, 
                    // let the execution proceed!
                    if (semaphore) {
                        // execute and return the query results
                        GQLClient_1.default.getInstance().request(query, variables)
                            .then(function (data) {
                            clearInterval(semaphoreInterval);
                            DelinquencyQueue.releaseExecutionSemaphore();
                            return data;
                        })
                            .then(resolve)
                            .catch(reject);
                    }
                });
            }, SEMAPHORE_TIMER);
        });
    };
    DelinquencyQueue.prototype.startLogTimer = function () {
        var logTimeInterval;
        var time = 0;
        logTimeInterval = setInterval(function () {
            setTimeout(function () { return Logger_1.default.verbose('Time: %s seconds', time++); }, 1000);
        }, 1000);
    };
    DelinquencyQueue.prototype.isEmpty = function () {
        return this.count === 0;
    };
    DelinquencyQueue.prototype.startInspector = function () {
        var _this_1 = this;
        if (!DelinquencyQueue.inspector) {
            Logger_1.default.verbose('Beginning Query Queue Inspector');
            DelinquencyQueue.inspector = setInterval(function () {
                if (_this_1.count == 0) {
                    _this_1.stopInspector();
                    _this_1.queueIsEmpty();
                }
            }, DelinquencyQueue.groomRate);
        }
    };
    DelinquencyQueue.prototype.stopInspector = function () {
        if (DelinquencyQueue.inspector)
            clearInterval(DelinquencyQueue.inspector);
    };
    DelinquencyQueue.prototype.add = function (query, variables) {
        var _this = this;
        return new Promise(function (resolve, reject) {
            if (!DelinquencyQueue.isFull) {
                var queuingInterval_1 = setInterval(function () {
                    DelinquencyQueue.getQueuingSemaphore()
                        .then(function (semaphore) {
                        if (semaphore) {
                            // release interval to alleviate the event loop 
                            DelinquencyQueue.releaseQueuingSemaphore();
                            // add the query into the main queue
                            _this.executeQuery(query, variables)
                                .then(function (data) {
                                clearInterval(queuingInterval_1);
                                return data;
                            })
                                .then(resolve)
                                .catch(reject);
                        }
                    });
                }, SEMAPHORE_TIMER);
            }
            else {
                Logger_1.default.warn('Query waiting on delinquency queue to free up');
                // when element from main queue is removed, execute delinquent query
                _this.on('remove', function () {
                    var queuingInterval = setInterval(function () {
                        DelinquencyQueue.getQueuingSemaphore()
                            .then(function (semaphore) {
                            if (semaphore) {
                                // release interval to alleviate the event loop 
                                DelinquencyQueue.releaseQueuingSemaphore();
                                // add the query into the main queue
                                _this.executeQuery(query, variables)
                                    .then(function (data) {
                                    clearInterval(queuingInterval);
                                    return data;
                                })
                                    .then(resolve)
                                    .catch(reject);
                            }
                        });
                    }, SEMAPHORE_TIMER);
                });
            }
        });
    };
    DelinquencyQueue.prototype.addedToQueue = function () {
        this.count++;
        this.emit('add');
        Logger_1.default.verbose('Adding query to queue. Count: %s', this.count);
    };
    DelinquencyQueue.prototype.removedFromQueue = function () {
        this.count--;
        if (this.count <= DELINQUENCY_RATE) {
            this.emit('remove');
            DelinquencyQueue.isFull = false;
            Logger_1.default.verbose('element removed from queue. Count: %s', this.count);
        }
        else
            throw new Error('Queue is above rate limit of ' + DELINQUENCY_RATE);
    };
    DelinquencyQueue.prototype.queueIsEmpty = function () {
        this.emit('empty');
        Logger_1.default.verbose('query queue is now empty');
    };
    DelinquencyQueue.prototype.queueIsFull = function () {
        this.emit('full');
        DelinquencyQueue.isFull = true;
        Logger_1.default.warn('Query Queue capacity of %s hit. Further queries are being queued for execution', DELINQUENCY_RATE);
    };
    DelinquencyQueue.isFull = false;
    DelinquencyQueue.groomRate = 1000;
    return DelinquencyQueue;
}(events_1.EventEmitter));
exports.default = DelinquencyQueue;
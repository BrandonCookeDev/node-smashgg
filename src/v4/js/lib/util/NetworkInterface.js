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
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
var request_promise_1 = __importDefault(require("request-promise"));
var graphql_request_1 = require("graphql-request");
var events_1 = require("events");
var Logger_1 = __importDefault(require("./Logger"));
var Common = __importStar(require("./Common"));
var StaggeredRequestQueue_1 = __importDefault(require("./StaggeredRequestQueue"));
var TokenHandler_1 = __importDefault(require("./TokenHandler"));
var Common_1 = require("./Common");
//import {ITournament, IEvent, IPhase, IPhaseGroup, IPlayer, IGGSet} from '../internal'
var API_URL = process.env.ApiUrl || 'https://api.smash.gg/gql/alpha';
var RATE_LIMIT_MS_TIME = process.env.RateLimitMsTime || 1000;
var TOTAL_PAGES_REGEX_JSON = new RegExp(/"pageInfo":[\s]?{[\n\s]*?"totalPages": ([0-9]*)/);
var TOTAL_PAGES_REGEX_STRING = new RegExp(/"pageInfo":{"totalPages":([0-9]*)}/);
var DELINQUENCY_TIMER = 60000;
var MAX_COMPLEXITY = 1000;
var NetworkInterface = /** @class */ (function (_super) {
    __extends(NetworkInterface, _super);
    function NetworkInterface() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    NetworkInterface.init = function () {
        NetworkInterface.client = new graphql_request_1.GraphQLClient(API_URL, NetworkInterface.getHeaders());
        NetworkInterface.isClientDelinquent = false;
        NetworkInterface.initialized = true;
        NetworkInterface.delinquencyQueue = [];
        NetworkInterface.delinquencyPaginatedQueue = [];
        NetworkInterface.queryCount = 0;
        NetworkInterface.resetDelinquency = setInterval(function () {
            NetworkInterface.queryCount = 0;
            NetworkInterface.isClientDelinquent = false;
            if (NetworkInterface.delinquencyQueue.length > 0) {
                NetworkInterface.delinquencyQueue.forEach(function (fcn) {
                    fcn();
                });
            }
            if (NetworkInterface.delinquencyPaginatedQueue.length > 0) {
                NetworkInterface.delinquencyPaginatedQueue.forEach(function (fcn) {
                    fcn();
                });
            }
        }, DELINQUENCY_TIMER);
    };
    NetworkInterface.getHeaders = function () {
        var token = TokenHandler_1.default.getToken();
        if (!token)
            throw new Error('Cannot initialize without a token for smash.gg');
        return {
            headers: {
                'X-Source': 'smashgg.js',
                'Content-Type': 'application/json',
                'Authorization': "Bearer " + token
            }
        };
    };
    /**
     * query
     *
     * takes a graphql query string and corresponding variable object
     * and puts the execution of this query into a queue which is staggered
     * by the standard rate limit imposed by smashgg.
     *
     * Useful for when many queries need to be run consecutively
     *
     * @param  {string} query
     * @param  {object} variables
     * @returns {promise} resolving the results of the query after being staggered in the request queue
     */
    NetworkInterface.query = function (query, variables) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!!NetworkInterface.isClientDelinquent) return [3 /*break*/, 2];
                        NetworkInterface.queryCount++;
                        return [4 /*yield*/, NetworkInterface.client.request(query, variables)];
                    case 1: return [2 /*return*/, _a.sent()];
                    case 2:
                        Logger_1.default.warn('Request per minute threshold exceeded. Queuing your request for the next pass...');
                        return [2 /*return*/, NetworkInterface.addToDelinquencyQueue(query, variables)];
                }
            });
        });
    };
    NetworkInterface.addToDelinquencyQueue = function (query, variables) {
        return new Promise(function (resolve, reject) {
            NetworkInterface.delinquencyQueue.push(function () {
                NetworkInterface.query(query, variables)
                    .then(resolve)
                    .catch(reject);
            });
        });
    };
    NetworkInterface.addToDelinquencyPaginatedQueue = function (operationName, queryString, params, options, additionalParams, complexitySubtraction) {
        if (complexitySubtraction === void 0) { complexitySubtraction = 0; }
        return new Promise(function (resolve, reject) {
            NetworkInterface.delinquencyQueue.push(function () {
                NetworkInterface.paginatedQuery(operationName, queryString, params, options, additionalParams, complexitySubtraction)
                    .then(resolve)
                    .catch(reject);
            });
        });
    };
    NetworkInterface.staggeredQuery = function (query, variables) {
        return new Promise(function (resolve, reject) {
            StaggeredRequestQueue_1.default.getInstance().add(function () {
                return NetworkInterface.client.request(query, variables)
                    .then(resolve)
                    .catch(reject);
            });
        });
    };
    NetworkInterface.singleQuery = function (query, variables) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, Common.sleep(+RATE_LIMIT_MS_TIME)];
                    case 1:
                        _a.sent();
                        return [4 /*yield*/, NetworkInterface.client.request(query, variables)];
                    case 2: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    NetworkInterface.query3 = function (query, variables) {
        return __awaiter(this, void 0, void 0, function () {
            var options;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        options = {
                            method: 'POST',
                            headers: NetworkInterface.getHeaders().headers,
                            uri: API_URL,
                            body: {
                                query: query,
                                variables: variables
                            },
                            json: true
                        };
                        return [4 /*yield*/, Common.sleep(+RATE_LIMIT_MS_TIME)];
                    case 1:
                        _a.sent();
                        return [4 /*yield*/, request_promise_1.default(options)];
                    case 2: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    NetworkInterface.paginatedQuery = function (operationName, queryString, params, options, additionalParams, complexitySubtraction) {
        if (complexitySubtraction === void 0) { complexitySubtraction = 0; }
        return __awaiter(this, void 0, void 0, function () {
            var page, perPage, filters, queryOptions, query, data, totalPages, complexity, isForcingPerPage, optimizedData, i, _a, _b;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        Logger_1.default.info('%s: Calling Paginated Querys', operationName);
                        page = options != undefined && options.page ? options.page : 1;
                        perPage = options != undefined && options.perPage ? options.perPage : 1;
                        filters = options != undefined && options.filters ? options.filters : null;
                        queryOptions = {
                            page: page,
                            perPage: perPage,
                            filters: filters,
                            pageInfo: 'pageInfo{\ntotalPages\n}'
                        };
                        queryOptions = Object.assign(queryOptions, additionalParams);
                        query = Common_1.mergeQuery(queryString, queryOptions);
                        return [4 /*yield*/, NetworkInterface.query(query, params)];
                    case 1:
                        data = [_c.sent()];
                        if (data.length <= 0)
                            throw new Error(operationName + ": No data returned from query for operation");
                        totalPages = NetworkInterface.parseTotalPages(operationName, data);
                        complexity = NetworkInterface.determineComplexity(data[0]) - complexitySubtraction //Object.keys(data[0]).length
                        ;
                        Logger_1.default.info('Total Pages using 1 perPage: %s, Object Complexity per Page: %s', totalPages, complexity);
                        isForcingPerPage = perPage > 1 && options != undefined && options.perPage != undefined // TODO this logic is probably superficial
                        ;
                        if (!!isForcingPerPage) return [3 /*break*/, 3];
                        perPage = NetworkInterface.calculateOptimalPagecount(complexity, totalPages);
                        Logger_1.default.info('Optimal Per Page Count: %s', perPage);
                        queryOptions = {
                            page: page++,
                            perPage: perPage,
                            filters: filters,
                            pageInfo: 'pageInfo{\ntotalPages\n}'
                        };
                        //queryOptions = Object.assign(queryOptions, additionalParams)
                        query = Common_1.mergeQuery(queryString, queryOptions);
                        return [4 /*yield*/, NetworkInterface.query(query, params)];
                    case 2:
                        optimizedData = _c.sent();
                        data = data.concat([optimizedData]);
                        totalPages = NetworkInterface.parseTotalPages(operationName, optimizedData);
                        Logger_1.default.info('Optimal Page Count: %s', totalPages);
                        return [3 /*break*/, 4];
                    case 3:
                        Logger_1.default.warn('Implementer has chosen to force perPage at %s per page', perPage);
                        _c.label = 4;
                    case 4:
                        i = page;
                        _c.label = 5;
                    case 5:
                        if (!(i <= totalPages)) return [3 /*break*/, 8];
                        Logger_1.default.info('%s: Collected %s/%s pages', operationName, i, totalPages);
                        queryOptions = Object.assign({
                            page: page + i,
                            perPage: perPage,
                            filters: filters,
                            pageInfo: ''
                        }, additionalParams);
                        query = Common_1.mergeQuery(queryString, queryOptions);
                        _b = (_a = data).push;
                        return [4 /*yield*/, NetworkInterface.query(query, params)];
                    case 6:
                        _b.apply(_a, [_c.sent()]);
                        _c.label = 7;
                    case 7:
                        i++;
                        return [3 /*break*/, 5];
                    case 8: return [2 /*return*/, data];
                }
            });
        });
    };
    NetworkInterface.parseTotalPages = function (operationName, results) {
        var parsed = TOTAL_PAGES_REGEX_STRING.exec(JSON.stringify(results));
        if (!parsed)
            throw new Error(operationName + ": Something wrong with paginated query. Did not match regex " + TOTAL_PAGES_REGEX_STRING.toString());
        return +parsed[1];
    };
    NetworkInterface.calculateOptimalPagecount = function (objectComplexity, totalPages) {
        var totalComplexity = objectComplexity * totalPages;
        Logger_1.default.verbose('Calculating Optimal Pagecount: Complexity [%s], Total Pages [%s], Total Complexity [%s]', objectComplexity, totalPages, totalComplexity);
        if (totalComplexity < MAX_COMPLEXITY)
            return Math.ceil(MAX_COMPLEXITY / objectComplexity / totalPages);
        else
            return Math.floor((objectComplexity * totalPages) / MAX_COMPLEXITY);
    };
    NetworkInterface.determineComplexity = function (objects) {
        var complexity = 0;
        var nextArgs = [];
        for (var i in objects) {
            // add 1 for each object passed into the function arg array
            complexity++;
            var cur = objects[i];
            for (var key in cur) {
                if (key === 'pageInfo')
                    continue;
                else if (typeof cur[key] === 'object' && cur[key] != null) {
                    // if array, calculate the first object then multiple by how many perPage
                    // otherwise add object to nextArgs and dig
                    if (Array.isArray(cur[key])) {
                        complexity *= cur[key].length;
                        nextArgs.push(cur[key][0]);
                    }
                    else {
                        nextArgs.push(cur[key]);
                    }
                }
            }
        }
        if (nextArgs.length === 0)
            return complexity;
        else
            return complexity + NetworkInterface.determineComplexity(nextArgs);
    };
    NetworkInterface.initialized = false;
    NetworkInterface.isClientDelinquent = false;
    NetworkInterface.queryCount = 0;
    return NetworkInterface;
}(events_1.EventEmitter));
exports.default = NetworkInterface;
module.exports = NetworkInterface;

var http = require("http");
var controller = exports.controller = {};
controller.get = {
    index: function () {
        var res = this.response;

        var options = {
                host: 'api.t.sina.com.cn',
                path: '/statuses/public_timeline.json?source=117815021'
            };
        //http://api.t.sina.com.cn/statuses/public_timeline.json?source=117815021
        var request = http.request(options, function(response) {
            var data = '';

            response.on('data',function (chunk) {
                data += chunk;
            }).on('end', function () {
                res.writeHead(200, {'Content-Type':'application/json'});
                res.write(data);
                res.end();
            });
        });
        request.end();
    },
    public_timeline: function () {
        var res = this.response;

        var options = {
                host: 'api.t.sina.com.cn',
                path: '/statuses/public_timeline.json?source=117815021'
            };
        //http://api.t.sina.com.cn/statuses/public_timeline.json?source=117815021
        var request = http.request(options, function(response) {
            var data = '';

            response.on('data',function (chunk) {
                data += chunk;
            }).on('end', function () {
                res.writeHead(200, {'Content-Type':'application/json'});
                res.write(data);
                res.end();
            });
        });
        request.end();
    }
};
controller.post = {
    // 如果数据中存在userId, 则表明用户切换回了watching状态，需要帮助清除掉db中的数据
    // 提交用户的地理位置，帮用户返回周围的等车的人和未载人的车
    watching: function () {
        var that = this,
            res = that.response,
            req = that.request;
        //生成collection对象
        var locations = req.db.collection("locations");
        var location = JSON.parse(req.post);
        if (location.userId) {
            locations.remove({userId: location.userId}, function () {
                console.log(arguments);
            });
        }
        //查询条件
        var condition = {
                "lat": {
                    $gt: (location.lat - watchDeflection),
                    $lt: location.lat + watchDeflection
                },
                "lng": {
                    $gt: location.lng - watchDeflection,
                    $lt: location.lng + watchDeflection
                }
            };
        locations.findItems(condition, function (err, object) {
            if (err) {
                console.log(err.stack);
                res.writeHeader(500, {'Content-Type':'text/plain', "Access-Control-Allow-Origin": "http://localhost"});
                res.end(err.stack);
            } else {
                res.writeHeader(200, {'Content-Type':'application/json', "Access-Control-Allow-Origin": "http://localhost"});
                res.end(JSON.stringify(object));
            }
        });
    },
    // 用户进入matching状态，会提交最新的地理位置
    matching: function () {
        var that = this,
            res = that.response,
            req = that.request;
        //生成collection对象
        var locations = req.db.collection("locations");
        var bookedUsers = req.db.collection("booked");
        var location = JSON.parse(req.post);
        if (location.userId) {
            locations.remove({userId: location.userId}, function () {
                console.log(arguments);
            });
        }
        
        //存储当前用户的信息到db中，以供被匹配
        locations.update({"userId": location.userId}, location, {upsert: true}, function (err) {
            if (err) {
                console.log(err.stack);
                res.end(err.stack);
            } else {
                console.log("saved location into db.");
            }
        });
        //查询条件
        var condition = {
                "lat": {
                    $gt: (location.lat - matchDeflection),
                    $lt: location.lat + matchDeflection
                },
                "lng": {
                    $gt: location.lng - matchDeflection,
                    $lt: location.lng + matchDeflection
                },
                "type": {
                    $ne: location.type
                }
            };
        console.log(condition);
        //查找数据库
        locations.findOne(condition, function(err, object) {
            console.log(arguments);
            if (err) {
                console.log(err.stack);
                res.writeHeader(500, {'Content-Type':'text/plain', "Access-Control-Allow-Origin": "*"});
                res.end(err.stack);
            } else {
                if (object) {
                    // 保存匹配到的两个用户到bookedUsers集合中，并从locations集合中移除掉
                    var token = Math.random().toString(32).substring(2);
                    object.matched = location.userId;
                    object.token = token;
                    bookedUsers.save(object);
                    location.matched = object.userId;
                    location.token = token;
                    bookedUsers.save(location);

                    //存储当前用户的信息到db中，以供被匹配
                    locations.remove({"userId": { $in: [location.userId, object.userId]}});
                }
                //查询条件
                var watchCondition = {
                        "lat": {
                            $gt: (location.lat - watchDeflection),
                            $lt: location.lat + watchDeflection
                        },
                        "lng": {
                            $gt: location.lng - watchDeflection,
                            $lt: location.lng + watchDeflection
                        }
                    };
                locations.findItems(watchCondition, function (err, items) {
                    if (err) {
                        console.log(err.stack);
                        res.writeHeader(500, {'Content-Type':'text/plain', "Access-Control-Allow-Origin": "http://localhost"});
                        res.end(err.stack);
                    } else {
                        res.writeHeader(200, {'Content-Type':'application/json', "Access-Control-Allow-Origin": "http://localhost"});
                        var result = {collection: items, matched: object};
                        res.end(JSON.stringify(result));
                    }
                });
            }
        });
    },
    booked: function () {
        var that = this,
            res = that.response,
            req = that.request;
        //生成collection对象
        var bookedUsers = req.db.collection("booked");
        var location = JSON.parse(req.post);
        //存储当前用户的信息到db中，以供被匹配
        bookedUsers.findAndModify({"userId": location.userId}, [], {$set: location}, {upsert: true, "new": true}, function (err, object) {
            console.log(arguments);
            if (err) {
                console.log(err.stack);
                res.end(err.stack);
            } else {
                console.log("update location into booked db.");
                //查找数据库
                //查询条件
                var condition = {"userId": object.matched, "token": object.token};
                console.log(condition);
                bookedUsers.findOne(condition, function(err, object) {
                    console.log("find items");
                    console.log(arguments);
                    if (err) {
                        console.log(err.stack);
                        res.writeHeader(500, {'Content-Type':'text/plain', "Access-Control-Allow-Origin": "http://localhost"});
                        res.end(err.stack);
                    } else {
                        res.writeHeader(200, {'Content-Type':'application/json', "Access-Control-Allow-Origin": "http://localhost"});
                        res.end(JSON.stringify(object));
                    }
                });
            }
        });
    },
    success: function () {
        var that = this,
            res = that.response,
            req = that.request;
        //生成collection对象
        var bookedUsers = req.db.collection("booked");
        var location = JSON.parse(req.post);
        location.success = true;
        //存储当前用户的信息到db中，以供被匹配
        bookedUsers.findAndModify({"userId": location.userId}, [], {$set: location}, {upsert: true, "new": true}, function (err, object) {
            console.log(arguments);
            if (err) {
                console.log(err.stack);
                res.end(err.stack);
            } else {
                console.log("final success.");
                res.writeHeader(200, {'Content-Type':'application/json', "Access-Control-Allow-Origin": "http://localhost"});
                res.end();
            }
        });
    }
};

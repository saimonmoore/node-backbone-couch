if (global.GENTLY) {
  require = global.GENTLY.hijack(require);
}

(function() {

	function callback(options) {
		return function(err, doc) {

			var onError = options.error
			,  onSuccess = options.success;
			delete options.error;
			delete options.success;

			if (doc) {
				if (doc.rows) {
					doc = _.map(doc.rows, function(d) { return d.value;});
				}
				else {
					doc = doc.json || doc;
					doc.id && (doc._id = doc.id);
					doc.rev && (doc._rev = doc.rev);
					_.each(['id', 'rev', 'ok'], function(attr) { delete doc[attr]});
				}
			}

			if (err) {
				onError && onError();
			}
			else {
				onSuccess && onSuccess(doc);
			}
		};
	};

  var _ = require('underscore');
  var BackboneCouch = {
    db_name: 'backbone_couch'
    , connection_data: {
        host: '127.0.0.1'
        , port: 5984
        , options: {
            cache: true
          , raw: false
        }
    }
  };

  BackboneCouch.db = function(callback) {
		var cradle = require('cradle');
    cradle.setup(this.connection_data);

    this._connection = this._connection || new(cradle.Connection)();
    this._db = this._db || this._connection.database(this.db_name || 'Untitled');

		var self = this;
		if (!this._db.created) {
			this._db.exists(function(err, ok) {
        if (err) {
					callback(err, self._db);
        }
        else {
          if (!ok) {
            self._db.create(function(err, resp) {
              if (!err) {
                self._db.created = true;
                callback(err, self._db);
              }
              else {
                self._db.created = false;
                callback(err, false);
              }
            });
          }
          else {
            self._db.created = true;
            callback(false, self._db);
          }
        }
			});
		}
		else {
			callback(false, this._db);
		}
  };

	BackboneCouch.read = function(object, options) {
		if (object.models) {
			this.read_collection(object, options);
		}
		else {
			this.read_model(object, options);
		}
	};

	BackboneCouch.read_model = function(model, options) {
		this.db(function(err, db) {
			if (!err) {
        db.get(model.id, callback(options));
			}
			else {
			  options.error && options.error();
			}
		});
	};

	BackboneCouch.read_collection = function(collection, options) {
		var view = collection.view_name || 'collection/all'
		, view_opts = options.view_opts || {};
		delete options.view_opts;

		this.db(function(err, db) {
			if (!err) {
				if (!collection.viewExists) {
          matches = view.match(/^(\w+)\/(.*)$/);
					db.head('/_design/' + matches[1] + '/_view/' + matches[2], function(err, resp, status) {
						if (status > 399) {
							var views = {};
							views[matches[2]] = {
                "map": function(doc) {
									       if (doc.collection) {
											 		 emit(doc.collection, doc);
											 	 }
								       }
							};

							db.save('_design/' + matches[1], views, function(err, resp, status) {
								if (!err) {
							    collection.viewExists = true;
                  db.view(view, view_opts, callback(options));
								}
								else {
									console.log('Unable to create view for collection: ' + matches[1]);
								}
							});
						}
						else {
							collection.viewExists = true;
              db.view(view, view_opts, callback(options));
						}
					});
				}
				else {
          db.view(view, view_opts, callback(options));
				}
			}
			else {
			  options.error && options.error();
			}
		});
	};

	BackboneCouch.createOrUpdate = function(model, options) {
		var args = [model.toJSON(), callback(options)];

		if (!model.isNew()) {
			args.unshift(model.id);
		}
		else {
			if (model.collection && model.collection.view_name) {
        if (matches = model.collection.view_name.match(/^(\w+)\/.*$/)) {
			    var collectionName = matches[1];
					model.set({collection: collectionName}, {silent: true});
					args[0].collection = collectionName;
				}
			}
		}

		this.db(function(err, db) {
			if (!err) {
		    db.save.apply(db, args);
			}
			else {
			  options.error && options.error();
			}
		});
	};

	BackboneCouch.destroy = function(model, options) {
		this.db(function(err, db) {
			if (!err) {
				db.remove(model.id, model.get('_rev'), function(err, resp) {
					if (!err) {
						model.set({'deleted': true, '_rev': resp.rev});
					}

					callback(options)(err, resp);
				});
			}
			else {
			  options.error && options.error();
			}
		});

	};

	BackboneCouch.__destroyDB = function(cb) {
		var self = this;
		this.db(function(err, db) {
			if (!err) {
        db.destroy(function(err, ok) {
					if (!err) { 
						self._db.created = false;
					}
				  cb();
				});
			}
			else {
			  cb();
			}
		});
	};

	BackboneCouch.sync = function(method, object, options) {
		switch (method) {
				case "read":
					return this.read(object, options);
				case "create":
					return this.createOrUpdate(object, options);
				case "update":
					return this.createOrUpdate(object, options);
				case "delete":
					return this.destroy(object, options);
			}
	};

	_.bindAll(BackboneCouch, "sync", "createOrUpdate","read","read_collection", "read_model", "db");

	module.exports = {
		sync: function(backbone) {
			backbone.Model.prototype.idAttribute = '_id';
			var bc = _.extend(BackboneCouch, {Model: backbone.Model});
			_.extend(backbone, bc);
			return bc;
	  }
	}
})();


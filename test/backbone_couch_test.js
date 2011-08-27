var tests = require('testosterone')( { sync: true, title: 'node-backbone-couch/test/backbone_couch_test.js'})
,   assert = tests.assert
,   gently = global.GENTLY = new (require('gently'))
,   cradle = require('saimonmoore-cradle')
,   _ =  require('underscore')
,   Backbone = require('backbone');


var BackboneCouch
,   User = Backbone.Model.extend({})
,   UsersCollection = Backbone.Collection.extend({view_name: 'users/all', model: User})
,   stubCradleConnection = function() {
    var Connection = gently.stub('cradle','Connection')
    , connection = {
        database: function(name){
          return {
            exists: function(cb) { cb(false, true);}
            , save : function() {
            }
          }
        }
      };

      gently.hijacked['cradle'].setup = function (options) {};
      gently.hijacked['cradle'].Connection = function (options) {
        return connection;
      };

      return connection;
    }
,   stubCradleDatabase = function(connection) {
      var document
      ,  _doc = { _rev: '2-76be', _id: 'f6av8', name: 'Mario'}
      database = {
        exists: function(cb) {cb(false, true);}
        , save : function(attributes, cb){
                 document = new(cradle.Response)(_doc);
                 if (cb) {
                   cb(document);
                 }
               }
        , get: function(argument) {}
      };

      gently.expect(connection, 'database', function(name) {
        return database;
      });

      return database;
    };

tests
  .before(function () {
  })

  .add('should create a cradle.Connection when saving a new model', function () {
    var connection = stubCradleConnection();
    gently.hijacked['cradle'].Connection = gently.expect(function (options) {
      assert.ok(_.isEmpty(options));
      return connection;
    });

    BackboneCouch = _.extend(Backbone, require('./../lib/backbone_couch').sync(Backbone));

    var Mario = new User({name: 'Mario'});
    Mario.save();
  })

  .add('should call cradle.database when saving a new model', function () {
    var document
    ,  _doc = { _rev: '2-76be', _id: 'f6av8', name: 'Mario'}
    ,  database = {
          exists: function(cb) { cb(true);}
        , save : function(attributes, cb){
               document = new(cradle.Response)(_doc);
               if (cb) {
                 cb(document);
               }
             }
        , get: function(argument) {}
       }
    , connection = stubCradleConnection();

  gently.expect(connection, 'database', function(name) {
    assert.equal('bla', name);
    return database;
  });

  BackboneCouch = require('./../lib/backbone_couch').sync(Backbone);
  BackboneCouch._connection = BackboneCouch._db = false;
  BackboneCouch.db_name = 'bla';

  var Mario = new User({name: 'Mario'});
  Mario.save();
  })

  .add('should save model attributes to the couch when creating a new model', function () {
    var database = stubCradleDatabase(stubCradleConnection())
    ,   _doc = {_rev: '2-76be', _id: 'f6av8'}
    ,   document;

    gently.expect(database, 'save', function stubbedSave(attrs, cb) {
      assert.deepEqual(attrs, {name: 'Mario'});
      document = new(cradle.Response)(_.extend(_doc, attrs));

      if (cb) {cb(false, document);}
    });

    BackboneCouch = require('./../lib/backbone_couch').sync(Backbone);
    BackboneCouch._connection = BackboneCouch._db = false;

    var Mario = new User({name: 'Mario'});
    Mario.save();

    gently.verify();

    assert.equal(Object.keys(document).length, 3);
    assert.equal(document.name, 'Mario');
    assert.deepEqual(document.json, _doc);
  })

  .add('should update model attributes and revision on the couch when updating a new model', function () {
    var database = stubCradleDatabase(stubCradleConnection())
    ,   _doc = {_rev: '3-86cf', _id: 'f6av8', name: 'Sofia'}
    ,   document;

    gently.expect(database, 'save', function stubbedSave(id, attrs, cb) {
      assert.equal(id, 'f6av8');
      assert.deepEqual(attrs, {_rev: '2-76be', _id: 'f6av8', name: 'Sofia'});
      document = new(cradle.Response)(_doc);

      if (cb) {cb(false, document);}
    });

    BackboneCouch = require('./../lib/backbone_couch').sync(Backbone);
    BackboneCouch._connection = BackboneCouch._db = false;

    var Mario = new User({_id: 'f6av8', _rev: '2-76be', name: 'Mario'});
    Mario.save({name: 'Sofia'});

    assert.equal(Mario.get('name'), 'Sofia');
    assert.equal(Mario.get('_rev'), '3-86cf');
    assert.equal(Mario.id, 'f6av8');
  })


  .add('should fetch data from the couch when calling collection.fetch()', function () {
    var database = stubCradleDatabase(stubCradleConnection())
    , _doc = {_rev: '2-76be', _id: 'f6av8', name: 'Mario'}
    , documents;

    gently.expect(database, 'view', function(view, options, cb) {
      assert.equal(view, 'users/all');
      documents = [new(cradle.Response)(_doc)];

      if (cb) {cb(false, documents);}
    });

    BackboneCouch = require('./../lib/backbone_couch').sync(Backbone);
    BackboneCouch._connection = BackboneCouch._db = false;

    var Mario = new User({_id: 'f6av8', _rev: '2-76be', name: 'Mario'});
    var Users = new UsersCollection([Mario]);

    //assume we've created the view
    Users.viewExists = true;

    Users.fetch();

    assert.equal(Users.length, 1);
    assert.deepEqual(Users.models[0].attributes, Mario.attributes);
  })

  .add('should reset model data from the couch when calling model.fetch()', function () {
    var database = stubCradleDatabase(stubCradleConnection())
    , _doc = {_rev: '2-76be', _id: 'f6av8', name: 'Mario'}
    , document;

    gently.expect(database, 'get', function(id, cb) {
      assert.equal(id, 'f6av8');
      document = new(cradle.Response)(_doc);

      if (cb) {cb(false, document);}
    });

    BackboneCouch = require('./../lib/backbone_couch').sync(Backbone);
    BackboneCouch._connection = BackboneCouch._db = false;

    //Assume existing user
    var Mario = new User({_id: 'f6av8', _rev: '2-76be', name: 'Mario'});
    Mario.fetch();

    assert.equal(Mario.idAttribute, '_id');
    assert.equal(Object.keys(Mario.attributes).length, 3);
    assert.equal(Mario.attributes.name, 'Mario');
    assert.deepEqual(Mario.attributes, _doc);
  })

  .add('should destroy model data in the couch when calling model.destroy()', function () {
    var database = stubCradleDatabase(stubCradleConnection())
    , resp = {"ok": true, "rev": '2-83cd'}
    , document;

    gently.expect(database, 'remove', function(id, rev, cb) {
      assert.equal(id, 'f6av8');
      assert.equal(rev, '2-76be');
      document = new(cradle.Response)(resp);

      if (cb) {cb(false, document);}
    });

    BackboneCouch = require('./../lib/backbone_couch').sync(Backbone);
    BackboneCouch._connection = BackboneCouch._db = false;

    //Assume existing user
    var Mario = new User({_id: 'f6av8', _rev: '2-76be', name: 'Mario'})
    ,   Users = new UsersCollection([Mario]);

    //Should be in collection
    assert.equal(Users.length, 1);
    assert.equal(Users.get(Mario.id), Mario);

    Mario.destroy();

    //should be removed from collection
    assert.equal(Users.length, 0);

    //rev should now point to deletion stub
    assert.equal(Mario.get('_rev'), '2-83cd');

    //should be marked as deleted
    assert.ok(Mario.get('deleted'));
  })

  .run();


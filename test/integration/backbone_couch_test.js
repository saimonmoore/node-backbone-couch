var tests = require('testosterone')( { sync: false, title: 'node-backbone-couch/test/integration/backbone_couch_test.js'})
,   assert = tests.assert
,   cradle = require('saimonmoore-cradle')
,   _ =  require('underscore')
,   Backbone = require('backbone');

var BackboneCouch
,   User = Backbone.Model.extend({})
,   UsersCollection = Backbone.Collection.extend({view_name: 'users/all', model: User})
,   DBName = 'backbone_couch_test'
,   Connection = new(cradle.Connection)
,   DB = Connection.database(DBName);

function cleanup (cb) {
  DB.destroy(function(err, ok) {
    cb();
  });
}

cleanup(function() {
  tests
    .before(function () {
    })
    .after(function () {
    })
    .add('should save model attributes to the couch when creating a new model', function (next) {
      BackboneCouch = require('./../../lib/backbone_couch').sync(Backbone);
      BackboneCouch.db_name = 'backbone_couch_test';

      var Mario = new User({name: 'Mario'});
      assert.equal(Mario.idAttribute, '_id');
      assert.ok(Mario.isNew());

      function onCreate(model, resp) {
        assert.ok(!Mario.isNew());
        assert.ok(Mario.get('_rev'));
        assert.equal(Mario.id, Mario.get('_id'));
        cleanup(next);
      };

      Mario.save(false, {success: onCreate});
    })

    .add('should update model attributes and revision on the couch when updating a new model', function (next) {
      BackboneCouch = require('./../../lib/backbone_couch').sync(Backbone);
      BackboneCouch._connection = BackboneCouch._db = false;

      var Mario = new User({name: 'Mario'});
      var old_rev, new_rev;

      assert.ok(Mario.isNew());
      assert.equal(Mario.get('name'), 'Mario');

      function onFetch(model, resp){
        assert.equal(Mario.get('name'), 'Sofia');
        assert.ok(Mario.get('_rev') === new_rev);
        cleanup(next);
      };

      function onUpdate(model, resp) {
        assert.equal(Mario.get('name'), 'Sofia');
        assert.ok(Mario.get('_rev') !== old_rev);
        new_rev = Mario.get('_rev');

        Mario.fetch({success: onFetch});
      };

      function onCreate(model, resp) {
        assert.ok(!Mario.isNew());
        assert.equal(Mario.get('name'), 'Mario');
        old_rev = Mario.get('_rev');
        assert.ok(Mario.get('_rev'));
        assert.equal(Mario.id, Mario.get('_id'));

        Mario.save({name: 'Sofia'}, {success: onUpdate});
      };

      Mario.save(false, {success: onCreate});
    })

    .add('should fetch data from the couch when calling collection.fetch()', function (next) {
      BackboneCouch = require('./../../lib/backbone_couch').sync(Backbone);
      BackboneCouch._connection = BackboneCouch._db = false;

      var Mario = new User({name: 'Mario'})
      ,   Sofia = new User({name: 'Sofia'});

      var old_rev, new_rev;

      assert.ok(Mario.isNew());
      assert.ok(Sofia.isNew());
      assert.equal(Mario.get('name'), 'Mario');
      assert.equal(Sofia.get('name'), 'Sofia');

      var Users = new UsersCollection([Mario, Sofia]);
      assert.equal(Users.length, 2);

      function onFetch(collection, resp) {
        assert.equal(collection.length, 2);
        assert.deepEqual(collection.models[0].attributes, Mario.attributes);
        assert.deepEqual(collection.models[1].attributes, Sofia.attributes);
        cleanup(next);
      };

      function onSavedSofia(model, resp) {
        assert.ok(!Mario.isNew());
        assert.equal(Mario.get('collection'), 'users');
        assert.equal(Mario.collection, Users);

        Users.reset();
        assert.equal(Users.length, 0);

        Users.fetch({success: onFetch});
      };

      function onSavedMario(model, resp) {
        assert.ok(!Mario.isNew());
        assert.equal(Mario.get('collection'), 'users');
        assert.equal(Mario.collection, Users);

        Sofia.save(false, {success: onSavedSofia});
      };

      Mario.save(false, {success: onSavedMario});
    })

    .add('should allow passing view parameters', function (next) {
      BackboneCouch = require('./../../lib/backbone_couch').sync(Backbone);
      BackboneCouch.db_name = DBName;
      BackboneCouch._connection = BackboneCouch._db = false;

      var Children = Backbone.Collection.extend({
          view_name: 'users/by_age'
        , view: {
          "map": function(doc) {
                 if (doc.age) {
                   emit(doc.age, doc);
                 }
          }
        }
        , model: User
      });

      var Mario = new User({name: 'Mario', age: 1})
      ,   Sofia = new User({name: 'Sofia', age: 3})
      ,   Jan   = new User({name: 'Jan', age: 3})
      ,   Nil   = new User({name: 'Nil', age: 1});

      var Kids = new Children([Mario, Sofia, Jan, Nil]);
      assert.equal(Kids.length, 4);

      function onFetchAgain(toddlers, resp) {
        assert.equal(toddlers.length, 2);

        var names = _(toddlers.models).chain().map(function(model) { 
          return model.get('name');}).sortBy(function(name) { return name;});

        assert.deepEqual(['Jan', 'Sofia'], names.value());
        cleanup(next);
      };

      function onFetch(toddlers, resp) {
        assert.equal(toddlers.length, 2);

        var names = _(toddlers.models).chain().map(function(model) { 
          return model.get('name');}).sortBy(function(name) { return name;});

        assert.deepEqual(['Mario', 'Nil'], names.value());

        Kids.fetch({success: onFetchAgain, view_opts: {key: 3}});
      };

      var models = Kids.models
      ,   last = _.last(models).get('name');

      function onSave(model, resp) {
        if (model.get('name') === last) {
          Kids.fetch({success: onFetch, view_opts: {key: 1}});
        }
      };

      function onSaveMario(model, resp) {
        _.each([Sofia, Jan, Nil], function(model) {
          model.save(false, {success: onSave});
        });
      };

      Mario.save(false, {success: onSaveMario});
    })
    .add('should properly update existing design docs when creating views', function (next) {
      BackboneCouch = require('./../../lib/backbone_couch').sync(Backbone);
      BackboneCouch.db_name = DBName;
      BackboneCouch._connection = BackboneCouch._db = false;

      var ByAge = Backbone.Collection.extend({
          view_name: 'users/by_age'
        , view: {
          "map": function(doc) {
                 if (doc.age) {
                   emit(doc.age, doc);
                 }
          }
        }
        , model: User
      });

      var BySex = Backbone.Collection.extend({
          view_name: 'users/by_sex'
        , view: {
          "map": function(doc) {
                 if (doc.sex) {
                   emit(doc.sex, doc);
                 }
          }
        }
        , model: User
      });

      var count = 0;

      function onFetch(viewName) {
        return function(collection, resp) {
          DB.head('_design/users/_view/' + viewName, function(err, resp, status) {
            count++;
            assert.equal(status, 200);
            if (count === 2) {
              cleanup(next);
            }
          });
        }
      };

      new ByAge().fetch({success: onFetch('by_age')});
      new BySex().fetch({success: onFetch('by_sex')});
    })

    .add('should reset model data from the couch when calling model.fetch()', function (next) {
      BackboneCouch = require('./../../lib/backbone_couch').sync(Backbone);
      BackboneCouch._connection = BackboneCouch._db = false;

      var Mario = new User({name: 'Mario'});
      assert.equal(Mario.idAttribute, '_id');
      assert.ok(Mario.isNew());

      function onFetch(model, response) {
        assert.equal(Object.keys(model.attributes).length, 3);
        assert.ok(model.has('name'));
        assert.equal(model.get('name'), 'Mario');
        assert.ok(model.has('_id'));
        assert.ok(model.has('_rev'));

        cleanup(next);
      };

      function onSave(model, resp) {
        assert.ok(!Mario.isNew());
        Mario.unset('name', {silent: true});
        assert.ok(!Mario.has('name'));
        assert.ok(Mario.has('_id'));
        assert.ok(Mario.has('_rev'));

        Mario.fetch({success: onFetch});
      };

      Mario.save(false, {success: onSave});
    })

    .add('should destroy model data in the couch when calling model.destroy()', function (done) {
      BackboneCouch = require('./../../lib/backbone_couch').sync(Backbone);
      BackboneCouch._connection = BackboneCouch._db = false;

      var Mario = new User({name: 'Mario'})
      ,   Users = new UsersCollection([Mario])
      ,   old_rev;

      //Should be in collection
      assert.equal(Users.length, 1);

      function onCollectionFetch(collection, resp) {
        assert.equal(collection.length, 0);
        cleanup(done);
      };

      function onDestroy(model, response) {
        //should be removed from collection
        assert.equal(Users.length, 0);

        //rev should now point to deletion stub
        assert.ok(model.get('_rev') !== old_rev);

        //should be marked as deleted
        assert.ok(model.get('deleted'));

        //should not be on server
        Users.fetch({success: onCollectionFetch});
      };

      function onSave(model, resp) {
        assert.ok(!Mario.isNew());

        Mario.unset('name', {silent: true});

        assert.ok(!Mario.has('name'));
        assert.ok(Mario.has('_id'));
        assert.ok(Mario.has('_rev'));

        old_rev = Mario.get('_rev');

        //Should be in collection
        assert.equal(Users.length, 1);
        assert.equal(Users.get(Mario.id), Mario);

        Mario.destroy({success: onDestroy});
      };

      Mario.save(false, {success: onSave});
    })

    .run();
});


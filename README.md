      __                       __      __
      /\ \                     /\ \    /\ \
      \ \ \____     __      ___\ \ \/'\\ \ \____    ___     ___      __
       \ \ '__`\  /'__`\   /'___\ \ , < \ \ '__`\  / __`\ /' _ `\  /'__`\
        \ \ \L\ \/\ \L\.\_/\ \__/\ \ \\`\\ \ \L\ \/\ \L\ \/\ \/\ \/\  __/
         \ \_,__/\ \__/.\_\ \____\\ \_\ \_\ \_,__/\ \____/\ \_\ \_\ \____\
          \/___/  \/__/\/_/\/____/ \/_/\/_/\/___/  \/___/  \/_/\/_/\/____/


                                                 __
                                                /\ \
                      ___    ___   __  __    ___\ \ \___
                     /'___\ / __`\/\ \/\ \  /'___\ \  _ `\
                    /\ \__//\ \L\ \ \ \_\ \/\ \__/\ \ \ \ \
                    \ \____\ \____/\ \____/\ \____\\ \_\ \_\
                     \/____/\/___/  \/___/  \/____/ \/_/\/_/

node-backbone-couch is a node.js module designed to replace the default
Backbone.sync with persistance to a [couchdb](ttp://couchdb.apache.org/)
database.

i.e. It is designed to be used when using
[Backbone.js](http://documentcloud.github.com/backbone/) on the server side with node.

Uses [cradle](http://github.com/cloudhead/cradle) to handle interfacing
with couchdb.

## Install

    npm install node-backbone-couch

## Usage
```javascript
var Backbone = require('backbone')
,   BackboneCouch = require('backbone-couch').sync(Backbone);

//Set the db_name otherwise it defaults to 'backbone_couch'
BackboneCouch.db_name = 'couchfoo';

//Set the couchdb connection data if distinct from default
BackboneCouch.connection_data = {
        host: '127.0.0.1'
        , port: 5984
        , options: { //Cradle-specific options
            cache: true
          , raw: false
        }
    }

//Define your Backbone models/collections
var User = Backbone.Model.extend({})
,  	UsersCollection = Backbone.Collection.extend({url: 'users/all', model: User});

```

### Creating models (POST)

```javascript
//Call save on a newly instantiated Backbone model
var drfoo = new User({first_name: 'Baz', last_name: 'Foo', prefix: 'Dr'});

function onCreate(model, response) {
  //Do something with your model (e.g. render it, redirect etc)
};

drfoo.save(false, {success: onCreate});
```

Let's see what happened under the couch:

    127.0.0.1 - - 'HEAD' /couchfoo/? 404
    127.0.0.1 - - 'POST' /couch_foo/? 201
    127.0.0.1 - - 'PUT' /couch_foo/28b215f7aca21b6bf1a784ffc8001245? 201

node-backbone-couch will kindly create a couchdb database if one does
not exist with the name supplied by the 'db_name' property.

It then proceeds to create a document, within that database, describing the drfoo User.

### Fetching models (GET)

```javascript
//Call save on a newly instantiated Backbone model
var drfoo = new User({id: '28b215f7aca21b6bf1a784ffc8001245'});

function onFetch(model, response) {
  //Should no be populated with attributes from the couch
};

drfoo.fetch(false, {success: onFetch});
```

    127.0.0.1 - - 'GET' /couch_foo/28b215f7aca21b6bf1a784ffc8001245? 201

### Updating models (POST)


```javascript
drfoo.fetch();

drfoo.set({specialization: 'Geriatrics'})

function onUpdate(model, response) {
  //Do something with your model (e.g. render it, redirect etc)
};

drfoo.save(false, {success: onUpdate});
```

Let's see what happened under the couch:

    127.0.0.1 - - 'PUT' /couch_foo/28b215f7aca21b6bf1a784ffc8001245? 201

### Destroying models (DELETE)


```javascript

function onDestroy(model, response) {
  //Remove element from DOM?
};

drfoo.destroy(false, {success: onDestroy});
```

    127.0.0.1 - - 'DELETE' /couch_foo/28b215f7aca21b6bf1a784ffc80038c8?rev=1-e39294ca76f39e1aebc8261d7e3afa7b 200

### Collections


```javascript
//UsersCollection = Backbone.Collection.extend({url: 'users/all', model: User});

UsersCollection.add(drfoo);

//Save the model to persist the association with the collection
drfoo.save();

function onFetch(model, response) {
  //Loop through collection models
};

UsersCollection.fetch(false, {success: onFetch});

```

    127.0.0.1 - - 'PUT' /couch_foo/28b215f7aca21b6bf1a784ffc80038c8 200

    127.0.0.1 - - 'HEAD' /backbone_couch_test/_design/users/_view/all? 404
    127.0.0.1 - - 'PUT' /backbone_couch_test/_design/users? 201
    127.0.0.1 - - 'GET' /backbone_couch_test/_design/users/_view/all? 200

Again backbone-couch has made our life easy and gone ahead and created
a basic view (which will emit all documents whose collection attribute is
'users') for us and then populated the collection with models from the
results returned by the view.

Note: By changing the 'url' property you can back collections with
different views.

You can pass any view parameters via a 'view_opts' key in the 'options'
argument e.g.

```javascript
Fruit = Backbone.Collection.extend({url: 'fruit/by_fruit_name', model: Fruit});

Fruit.add([oranges, lemons]);

function onFetch(model, response) {
  //Loop through collection models
};

Fruit.fetch(false, {success: onFetch, view_opts: {key: 'lemons'}});

```


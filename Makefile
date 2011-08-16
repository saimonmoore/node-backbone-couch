NODE = node
COUCHDB = $(which couchdb)

test: test_backbone_couch test_integration

test_backbone_couch:
	@$(NODE) test/backbone_couch_test.js

test_integration:
	@$(NODE) test/integration/backbone_couch_test.js

.PHONY: test







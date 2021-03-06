'use strict';

import * as chai from 'chai';
import DataTypes from '../../lib/data-types';
import Support from './support';
const expect = chai.expect;

describe(Support.getTestDialectTeaser('Schema'), () => {
  beforeEach(function() {
    return this.sequelize.createSchema('testschema');
  });

  afterEach(function() {
    return this.sequelize.dropSchema('testschema');
  });

  beforeEach(function() {
    this.User = this.sequelize.define('User', {
      aNumber: { type: new DataTypes.INTEGER() }
    }, {
      schema: 'testschema'
    });

    return this.User.sync({ force: true });
  });

  it('supports increment', function() {
    return this.User.create({ aNumber: 1 }).then(user => {
      return user.increment('aNumber', { by: 3 });
    }).then(result => {
      return result.reload();
    }).then(user => {
      expect(user).to.be.ok;
      expect(user.aNumber).to.be.equal(4);
    });
  });

  it('supports decrement', function() {
    return this.User.create({ aNumber: 10 }).then(user => {
      return user.decrement('aNumber', { by: 3 });
    }).then(result => {
      return result.reload();
    }).then(user => {
      expect(user).to.be.ok;
      expect(user.aNumber).to.be.equal(7);
    });
  });
});

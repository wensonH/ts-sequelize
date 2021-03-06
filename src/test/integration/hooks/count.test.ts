'use strict';

import * as chai from 'chai';
import DataTypes from '../../../lib/data-types';
import Support from '../support';
const expect = chai.expect;

describe(Support.getTestDialectTeaser('Hooks'), () => {
  beforeEach(function() {
    this.User = this.sequelize.define('User', {
      username: {
        type: new DataTypes.STRING(),
        allowNull: false
      },
      mood: {
        type: new DataTypes.ENUM(),
        values: ['happy', 'sad', 'neutral']
      }
    });
    return this.sequelize.sync({ force: true });
  });

  describe('#count', () => {
    beforeEach(function() {
      return this.User.bulkCreate([
        {username: 'adam', mood: 'happy'},
        {username: 'joe', mood: 'sad'},
        {username: 'joe', mood: 'happy'},
      ]);
    });

    describe('on success', () => {
      it('hook runs', function() {
        let beforeHook = false;

        this.User.beforeCount(() => {
          beforeHook = true;
        });

        return this.User.count().then(count => {
          expect(count).to.equal(3);
          expect(beforeHook).to.be.true;
        });
      });

      it('beforeCount hook can change options', function() {
        this.User.beforeCount(options => {
          options.where.username = 'adam';
        });

        return expect(this.User.count({where: {username: 'joe'}})).to.eventually.equal(1);
      });
    });

    describe('on error', () => {
      it('in beforeCount hook returns error', function() {
        this.User.beforeCount(() => {
          throw new Error('Oops!');
        });

        return expect(this.User.count({where: {username: 'adam'}})).to.be.rejectedWith('Oops!');
      });
    });
  });

});

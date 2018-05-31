'use strict';

import * as chai from 'chai';
import * as _ from 'lodash';
import DataTypes from '../../../lib/data-types';
import Support from '../support';
const expect = chai.expect;
const current = Support.sequelize;

describe(Support.getTestDialectTeaser('Model'), () => {
  describe('update', () => {
    beforeEach(function() {
      this.Account = this.sequelize.define('Account', {
        ownerId: {
          type: new DataTypes.INTEGER(),
          allowNull: false,
          field: 'owner_id'
        },
        name: {
          type: new DataTypes.STRING()
        }
      });
      return this.Account.sync({force: true});
    });

    it('should only update the passed fields', function() {
      return this.Account
        .create({ ownerId: 2 })
        .then(account => this.Account.update({
          name: Math.random().toString()
        }, {
          where: {
            id: account.get('id')
          }
        }));
    });


    if (_.get(current.dialect.supports, 'returnValues.returning')) {
      it('should return the updated record', function() {
        return this.Account.create({ ownerId: 2 }).then(account => {
          return this.Account.update({ name: 'FooBar' }, {
            where: {
              id: account.get('id')
            },
            returning: true
          }).spread((count, accounts) => {
            const firstAcc = accounts[0];
            expect(firstAcc.ownerId).to.be.equal(2);
            expect(firstAcc.name).to.be.equal('FooBar');
          });
        });
      });
    }

    if (current.dialect.supports['LIMIT ON UPDATE']) {
      it('should only update one row', function() {
        return this.Account.create({
          ownerId: 2,
          name: 'Account Name 1'
        })
          .then(() => {
            return this.Account.create({
              ownerId: 2,
              name: 'Account Name 2'
            });
          })
          .then(() => {
            return this.Account.create({
              ownerId: 2,
              name: 'Account Name 3'
            });
          })
          .then(() => {
            const options = {
              where: {
                ownerId: 2
              },
              limit: 1
            };
            return this.Account.update({ name: 'New Name' }, options);
          })
          .then(account => {
            expect(account[0]).to.equal(1);
          });
      });
    }
  });
});
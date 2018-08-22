'use strict';

import * as chai from 'chai';
import * as sinon from 'sinon';
import DataTypes from '../../../lib/data-types';
import { ItestAttribute, ItestInstance } from '../../dummy/dummy-data-set';
import Support from '../../support';
const expect = chai.expect;
const current = Support.sequelize;
const Promise = current.Promise;

describe(Support.getTestDialectTeaser('Model'), () => {

  if (current.dialect.supports.upserts) {
    describe('method upsert', () => {
      const User = current.define<ItestInstance, ItestAttribute>('User', {
        name: new DataTypes.STRING(),
        virtualValue: {
          type: new DataTypes.VIRTUAL(),
          set(val) {
            return this.value = val;
          },
          get() {
            return this.value;
          }
        },
        value: new DataTypes.STRING(),
        secretValue: {
          type: new DataTypes.INTEGER(),
          allowNull: false
        },
        createdAt: {
          type: new DataTypes.DATE(),
          field: 'created_at'
        }
      });

      const UserNoTime = current.define<ItestInstance, ItestAttribute>('UserNoTime', {
        name: new DataTypes.STRING()
      }, {
        timestamps: false
      });

      let stub;
      let query;
      before(function() {
        query = current.query;

        sinon.stub(current, 'query').returns(Promise.resolve());
      });


      beforeEach(() => {
        stub = sinon.stub(current.getQueryInterface(), 'upsert').returns(Promise.resolve([true, undefined]));
      });

      afterEach(function() {
        current.query = query;
        stub.restore();
      });


      it('skip validations for missing fields', () => {
        return expect(User.upsert({
          name: 'Grumpy Cat'
        })).not.to.be.rejectedWith(current.ValidationError);
      });

      it('creates new record with correct field names', () => {
        return User
          .upsert({
            name: 'Young Cat',
            virtualValue: 999
          })
          .then(() => {
            expect(Object.keys(stub.getCall(0).args[1])).to.deep.equal([
              'name', 'value', 'created_at', 'updatedAt',
            ]);
          });
      });

      it('creates new record with timestamps disabled', () => {
        return UserNoTime
          .upsert({
            name: 'Young Cat'
          })
          .then(() => {
            expect(Object.keys(stub.getCall(0).args[1])).to.deep.equal([
              'name',
            ]);
          });
      });

      it('updates all changed fields by default', () => {
        return User
          .upsert({
            name: 'Old Cat',
            virtualValue: 111
          })
          .then(() => {
            expect(Object.keys(stub.getCall(0).args[2])).to.deep.equal([
              'name', 'value', 'updatedAt',
            ]);
          });
      });
    });
  }
});

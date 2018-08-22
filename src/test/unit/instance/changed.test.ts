'use strict';

import * as chai from 'chai';
import { Model } from '../../..';
import DataTypes from '../../../lib/data-types';
import { ItestAttribute, ItestInstance } from '../../dummy/dummy-data-set';
import Support from '../../support';
const expect = chai.expect;
const current = Support.sequelize;

describe(Support.getTestDialectTeaser('Instance'), () => {
  let User : Model<ItestInstance, ItestAttribute>;
  describe('changed', () => {
    beforeEach(function() {
      User = current.define<ItestInstance, ItestAttribute>('User', {
        name: new DataTypes.STRING(),
        birthday: new DataTypes.DATE(),
        yoj: new DataTypes.DATEONLY(),
        meta: new DataTypes.JSON()
      });
    });

    it('should return true for changed primitive', function() {
      const user = User.build({
        name: 'a'
      }, {
        isNewRecord: false,
        raw: true
      });

      expect(user.changed('meta')).to.equal(false);
      user.set('name', 'b');
      user.set('meta');
      expect(user.changed('name')).to.equal(true);
      expect(user.changed('meta')).to.equal(true);
    });

    it('should return false for unchanged primitive', function() {
      const user = User.build({
        name: 'a',
        meta: null
      }, {
        isNewRecord: false,
        raw: true
      });

      user.set('name', 'a');
      user.set('meta', null);
      expect(user.changed('name')).to.equal(false);
      expect(user.changed('meta')).to.equal(false);
    });

    it('should return true for multiple changed values', function() {
      const user = User.build({
        name: 'a',
        birthday: new Date(new Date().getTime() - 10)
      }, {
        isNewRecord: false,
        raw: true
      });

      user.set('name', 'b');
      user.set('birthday', new Date());
      expect(user.changed('name')).to.equal(true);
      expect(user.changed('birthday')).to.equal(true);
    });

    it('should return false for two instances with same value', function() {
      const milliseconds = 1436921941088;
      const firstDate = new Date(milliseconds);
      const secondDate = new Date(milliseconds);

      const user = User.build({
        birthday: firstDate
      }, {
        isNewRecord: false,
        raw: true
      });

      user.set('birthday', secondDate);
      expect(user.changed('birthday')).to.equal(false);
    });

    it('should return true for changed JSON with same object', function() {
      const user = User.build({
        meta: {
          city: 'Copenhagen'
        }
      }, {
        isNewRecord: false,
        raw: true
      });

      const meta = user.get('meta');
      meta.city = 'Stockholm';

      user.set('meta', meta);
      expect(user.changed('meta')).to.equal(true);
    });

    it('should return true for JSON dot.separated key with changed values', function() {
      const user = User.build({
        meta: {
          city: 'Stockholm'
        }
      }, {
        isNewRecord: false,
        raw: true
      });
      user.set('meta.city', 'Gothenburg');
      expect(user.changed('meta')).to.equal(true);
    });

    it('should return false for JSON dot.separated key with same value', function() {
      const user = User.build({
        meta: {
          city: 'Gothenburg'
        }
      }, {
        isNewRecord: false,
        raw: true
      });

      user.set('meta.city', 'Gothenburg');
      expect(user.changed('meta')).to.equal(false);
    });

    it('should return true for JSON dot.separated key with object', function() {
      const user = User.build({
        meta: {
          address: { street: 'Main street', number: '40' }
        }
      }, {
        isNewRecord: false,
        raw: true
      });

      user.set('meta.address', { street: 'Second street', number: '1' } );
      expect(user.changed('meta')).to.equal(true);
    });

    it('should return false for JSON dot.separated key with same object', function() {
      const user = User.build({
        meta: {
          address: { street: 'Main street', number: '40' }
        }
      }, {
        isNewRecord: false,
        raw: true
      });

      user.set('meta.address', { street: 'Main street', number: '40' } );
      expect(user.changed('meta')).to.equal(false);
    });

    it('should return false when changed from null to null', function() {
      const attributes = {};
      for (const attr in User.rawAttributes) {
        if (User.rawAttributes[attr]) {
          attributes[attr] = null;
        }
      }

      const user = User.build(attributes, {
        isNewRecord: false,
        raw: true
      });

      for (const attr in User.rawAttributes) {
        if (User.rawAttributes[attr]) {
          user.set(attr, null);
        }
      }

      for (const attr in User.rawAttributes) {
        if (User.rawAttributes[attr]) {
          expect(user.changed(attr), `${attr} is not changed`).to.equal(false);
        }
      }
    });

    describe('setDataValue', () => {
      it('should return false for unchanged primitive', function() {
        const user = User.build({
          name: 'a',
          meta: null
        }, {
          isNewRecord: false,
          raw: true
        });

        user.setDataValue('name', 'a');
        user.setDataValue('meta', null);
        expect(user.changed('name')).to.equal(false);
        expect(user.changed('meta')).to.equal(false);
      });
    });
  });
});

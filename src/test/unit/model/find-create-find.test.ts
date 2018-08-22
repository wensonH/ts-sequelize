'use strict';

import * as Promise from 'bluebird';
import * as chai from 'chai';
import * as sinon from 'sinon';
import { UniqueConstraintError } from '../../../lib/errors/index';
import { ItestAttribute, ItestInstance } from '../../dummy/dummy-data-set';
import Support from '../../support';
const expect = chai.expect;
const current = Support.sequelize;

describe(Support.getTestDialectTeaser('Model'), () => {
  describe('findCreateFind', () => {
    const Model = current.define<ItestInstance, ItestAttribute>('Model', {});

    beforeEach(function() {
      this.sinon = sinon.sandbox.create();
    });

    afterEach(function() {
      this.sinon.restore();
    });

    it('should return the result of the first find call if not empty', function() {
      const result = {};
      const where = {prop: Math.random().toString()};
      const findSpy = this.sinon.stub(Model, 'findOne').returns(Promise.resolve(result));

      return expect(Model.findCreateFind({
        where
      })).to.eventually.eql([result, false]).then(() => {
        expect(findSpy).to.have.been.calledOnce;
        expect(findSpy.getCall(0).args[0].where).to.equal(where);
      });
    });

    it('should create if first find call is empty', function() {
      const result = {};
      const where = {prop: Math.random().toString()};
      const createSpy = this.sinon.stub(Model, 'create').returns(Promise.resolve(result));

      this.sinon.stub(Model, 'findOne').returns(Promise.resolve(null));

      return expect(Model.findCreateFind({
        where
      })).to.eventually.eql([result, true]).then(() => {
        expect(createSpy).to.have.been.calledWith(where);
      });
    });

    it('should do a second find if create failed do to unique constraint', function() {
      const result = {};
      const where = {prop: Math.random().toString()};
      const findSpy = this.sinon.stub(Model, 'findOne');

      this.sinon.stub(Model, 'create').callsFake(() => {
        return Promise.reject(new UniqueConstraintError());
      });

      findSpy.onFirstCall().returns(Promise.resolve(null));
      findSpy.onSecondCall().returns(Promise.resolve(result));

      return expect(Model.findCreateFind({
        where
      })).to.eventually.eql([result, false]).then(() => {
        expect(findSpy).to.have.been.calledTwice;
        expect(findSpy.getCall(1).args[0].where).to.equal(where);
      });
    });
  });
});

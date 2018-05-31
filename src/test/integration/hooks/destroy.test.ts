'use strict';

import * as chai from 'chai';
import * as sinon from 'sinon';
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

  describe('#destroy', () => {
    describe('on success', () => {
      it('should run hooks', function() {
        const beforeHook = sinon.spy();
        const afterHook = sinon.spy();

        this.User.beforeDestroy(beforeHook);
        this.User.afterDestroy(afterHook);

        return this.User.create({username: 'Toni', mood: 'happy'}).then(user => {
          return user.destroy().then(() => {
            expect(beforeHook).to.have.been.calledOnce;
            expect(afterHook).to.have.been.calledOnce;
          });
        });
      });
    });

    describe('on error', () => {
      it('should return an error from before', function() {
        const beforeHook = sinon.spy();
        const afterHook = sinon.spy();

        this.User.beforeDestroy(() => {
          beforeHook();
          throw new Error('Whoops!');
        });
        this.User.afterDestroy(afterHook);

        return this.User.create({username: 'Toni', mood: 'happy'}).then(user => {
          return expect(user.destroy()).to.be.rejected.then(() => {
            expect(beforeHook).to.have.been.calledOnce;
            expect(afterHook).not.to.have.been.called;
          });
        });
      });

      it('should return an error from after', function() {
        const beforeHook = sinon.spy();
        const afterHook = sinon.spy();

        this.User.beforeDestroy(beforeHook);
        this.User.afterDestroy(() => {
          afterHook();
          throw new Error('Whoops!');
        });

        return this.User.create({username: 'Toni', mood: 'happy'}).then(user => {
          return expect(user.destroy()).to.be.rejected.then(() => {
            expect(beforeHook).to.have.been.calledOnce;
            expect(afterHook).to.have.been.calledOnce;
          });
        });
      });
    });
  });

});

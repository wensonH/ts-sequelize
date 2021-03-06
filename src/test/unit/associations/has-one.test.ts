'use strict';

import * as chai from 'chai';
import * as _ from 'lodash';
import DataTypes from '../../../lib/data-types';
import Support from '../../support';
const expect = chai.expect;
const current = Support.sequelize;

describe(Support.getTestDialectTeaser('hasOne'), () => {
  it('properly use the `as` key to generate foreign key name', () => {
    const User = current.define('User', { username: new DataTypes.STRING() });
    const Task = current.define('Task', { title: new DataTypes.STRING() });

    User.hasOne(Task);
    expect(Task.rawAttributes.UserId).not.to.be.empty;

    User.hasOne(Task, {as: 'Shabda'});
    expect(Task.rawAttributes.ShabdaId).not.to.be.empty;
  });

  it('should not override custom methods with association mixin', () => {
    const methods = {
      getTask: 'get',
      setTask: 'set',
      createTask: 'create'
    };
    const User = current.define('User');
    const Task = current.define('Task');

    _.each(methods, (alias, method) => {
      User.prototype[method] = function() {
        const realMethod = this.constructor.associations.task[alias];
        expect(realMethod).to.be.a('function');
        return realMethod;
      };
    });
    User.hasOne(Task, { as: 'task' });

    const user = User.build();

    _.each(methods, (alias, method) => {
      expect(user[method]()).to.be.a('function');
    });
  });
});

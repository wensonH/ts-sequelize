'use strict';

import * as chai from 'chai';
import DataTypes from '../../../lib/data-types';
import { ItestAttribute, ItestInstance } from '../../dummy/dummy-data-set';
import Support from '../support';
const expect = chai.expect;
const dialect = Support.getTestDialect();
const current = Support.sequelize;

describe(Support.getTestDialectTeaser('Model'), () => {
  describe('sync', () => {
    beforeEach(function() {
      const testSync = current.define<ItestInstance, ItestAttribute>('testSync', {
        dummy: new DataTypes.STRING()
      });
      return testSync.drop();
    });

    it('should remove a column if it exists in the databases schema but not the model', function() {
      const User = current.define<ItestInstance, ItestAttribute>('testSync', {
        name: new DataTypes.STRING(),
        age: new DataTypes.INTEGER()
      });
      return current.sync()
        .then(() => {
          current.define<ItestInstance, ItestAttribute>('testSync', {
            name: new DataTypes.STRING()
          });
        })
        .then(() => current.sync({alter: true}))
        .then(() => User.describe())
        .then(data => {
          expect(data).to.not.have.ownProperty('age');
          expect(data).to.have.ownProperty('name');
        });
    });

    it('should add a column if it exists in the model but not the database', function() {
      const testSync = current.define<ItestInstance, ItestAttribute>('testSync', {
        name: new DataTypes.STRING()
      });
      return current.sync()
        .then(() => current.define<ItestInstance, ItestAttribute>('testSync', {
          name: new DataTypes.STRING(),
          age: new DataTypes.INTEGER()
        }))
        .then(() => current.sync({alter: true}))
        .then(() => testSync.describe())
        .then(data => expect(data).to.have.ownProperty('age'));
    });

    it('should change a column if it exists in the model but is different in the database', function() {
      const testSync = current.define<ItestInstance, ItestAttribute>('testSync', {
        name: new DataTypes.STRING(),
        age: new DataTypes.INTEGER()
      });
      return current.sync()
        .then(() => current.define<ItestInstance, ItestAttribute>('testSync', {
          name: new DataTypes.STRING(),
          age: new DataTypes.STRING()
        }))
        .then(() => current.sync({alter: true}))
        .then(() => testSync.describe())
        .then(data => {
          expect(data).to.have.ownProperty('age');
          expect(data.age.type).to.have.string('CHAR'); // CHARACTER VARYING, VARCHAR(n)
        });
    });

    it('should not alter table if data type does not change', function() {
      const testSync = current.define<ItestInstance, ItestAttribute>('testSync', {
        name: new DataTypes.STRING(),
        age: new DataTypes.STRING()
      });
      return current.sync()
        .then(() => testSync.create({name: 'test', age: '1'}))
        .then(() => current.sync({alter: true}))
        .then(() => testSync.findOne())
        .then(data => {
          expect(data.dataValues.name).to.eql('test');
          expect(data.dataValues.age).to.eql('1');
        });
    });

    it('should properly create composite index without affecting individual fields', function() {
      const testSync = current.define<ItestInstance, ItestAttribute>('testSync', {
        name: new DataTypes.STRING(),
        age: new DataTypes.STRING()
      }, {indexes: [{unique: true, fields: ['name', 'age']}]});
      return current.sync()
        .then(() => testSync.create({name: 'test'}))
        .then(() => testSync.create({name: 'test2'}))
        .then(() => testSync.create({name: 'test3'}))
        .then(() => testSync.create({age: '1'}))
        .then(() => testSync.create({age: '2'}))
        .then(() => testSync.create({name: 'test', age: '1'}))
        .then(() => testSync.create({name: 'test', age: '2'}))
        .then(() => testSync.create({name: 'test2', age: '2'}))
        .then(() => testSync.create({name: 'test3', age: '2'}))
        .then(() => testSync.create({name: 'test3', age: '1'}))
        .then(data => {
          expect(data.dataValues.name).to.eql('test3');
          expect(data.dataValues.age).to.eql('1');
        });
    });
    it('should properly create composite index that fails on constraint violation', function() {
      const testSync = current.define<ItestInstance, ItestAttribute>('testSync', {
        name: new DataTypes.STRING(),
        age: new DataTypes.STRING()
      }, {indexes: [{unique: true, fields: ['name', 'age']}]});
      return current.sync()
        .then(() => testSync.create({name: 'test', age: '1'}))
        .then(() => testSync.create({name: 'test', age: '1'}))
        .then(data => expect(data).not.to.be.ok, error => expect(error).to.be.ok);
    });

    if (Support.getTestDialect() !== 'oracle') {
      //Table names too long for Oracle
      it('should properly alter tables when there are foreign keys', function() {
        const foreignKeyTestSyncA = current.define<ItestInstance, ItestAttribute>('foreignKeyTestSyncA', {
          dummy: new DataTypes.STRING()
        });

        const foreignKeyTestSyncB = current.define<ItestInstance, ItestAttribute>('foreignKeyTestSyncB', {
          dummy: new DataTypes.STRING()
        });

        foreignKeyTestSyncA.hasMany(foreignKeyTestSyncB);
        foreignKeyTestSyncB.belongsTo(foreignKeyTestSyncA);

        return current.sync({ alter: true })
          .then(() => current.sync({ alter: true }));
      });

      describe('indexes', () => {
        describe('with alter:true', () => {
          it('should not duplicate named indexes after multiple sync calls', function() {
            const User = current.define<ItestInstance, ItestAttribute>('testSync', {
              email: {
                type: new DataTypes.STRING()
              },
              phone: {
                type: new DataTypes.STRING()
              },
              mobile: {
                type: new DataTypes.STRING()
              }
            }, {
              indexes: [
                { name: 'another_index_email_mobile', fields: ['email', 'mobile'] },
                { name: 'another_index_phone_mobile', fields: ['phone', 'mobile'], unique: true },
                { name: 'another_index_email', fields: ['email'] },
                { name: 'another_index_mobile', fields: ['mobile'] },
              ]
            });

            return User.sync({ sync: true })
              .then(() => User.sync({ alter: true }))
              .then(() => User.sync({ alter: true }))
              .then(() => User.sync({ alter: true }))
              .then(() => current.getQueryInterface().showIndex(User.getTableName()))
              .then(results => {
                if (dialect === 'sqlite') {
                  // SQLite doesn't treat primary key as index
                  expect(results).to.have.length(4);
                } else {
                  expect(results).to.have.length(4 + 1);
                  expect(results.filter(r => r.primary)).to.have.length(1);
                }

                expect(results.filter(r => r.name === 'another_index_email_mobile')).to.have.length(1);
                expect(results.filter(r => r.name === 'another_index_phone_mobile')).to.have.length(1);
                expect(results.filter(r => r.name === 'another_index_email')).to.have.length(1);
                expect(results.filter(r => r.name === 'another_index_mobile')).to.have.length(1);
              });
          });

          it('should not duplicate unnamed indexes after multiple sync calls', function() {
            const User = current.define<ItestInstance, ItestAttribute>('testSync', {
              email: {
                type: new DataTypes.STRING()
              },
              phone: {
                type: new DataTypes.STRING()
              },
              mobile: {
                type: new DataTypes.STRING()
              }
            }, {
              indexes: [
                { fields: ['email', 'mobile'] },
                { fields: ['phone', 'mobile'], unique: true },
                { fields: ['email'] },
                { fields: ['mobile'] },
              ]
            });

            return User.sync({ sync: true })
              .then(() => User.sync({ alter: true }))
              .then(() => User.sync({ alter: true }))
              .then(() => User.sync({ alter: true }))
              .then(() => current.getQueryInterface().showIndex(User.getTableName()))
              .then(results => {
                if (dialect === 'sqlite') {
                  // SQLite doesn't treat primary key as index
                  expect(results).to.have.length(4);
                } else {
                  expect(results).to.have.length(4 + 1);
                  expect(results.filter(r => r.primary)).to.have.length(1);
                }
              });
          });
        });

        it('should create only one unique index for unique:true column', function() {
          const User = current.define<ItestInstance, ItestAttribute>('testSync', {
            email: {
              type: new DataTypes.STRING(),
              unique: true
            }
          });

          return User.sync({ force: true }).then(() => {
            return current.getQueryInterface().showIndex(User.getTableName());
          }).then(results => {
            if (dialect === 'sqlite') {
              // SQLite doesn't treat primary key as index
              expect(results).to.have.length(1);
            } else {
              expect(results).to.have.length(2);
              expect(results.filter(r => r.primary)).to.have.length(1);
            }

            expect(results.filter(r => r.unique === true && r.primary === false)).to.have.length(1);
          });
        });

        it('should create only one unique index for unique:true columns', function() {
          const User = current.define<ItestInstance, ItestAttribute>('testSync', {
            email: {
              type: new DataTypes.STRING(),
              unique: true
            },
            phone: {
              type: new DataTypes.STRING(),
              unique: true
            }
          });

          return User.sync({ force: true }).then(() => {
            return current.getQueryInterface().showIndex(User.getTableName());
          }).then(results => {
            if (dialect === 'sqlite') {
              // SQLite doesn't treat primary key as index
              expect(results).to.have.length(2);
            } else {
              expect(results).to.have.length(3);
              expect(results.filter(r => r.primary)).to.have.length(1);
            }

            expect(results.filter(r => r.unique === true && r.primary === false)).to.have.length(2);
          });
        });

        it('should create only one unique index for unique:true columns taking care of options.indexes', function() {
          const User = current.define<ItestInstance, ItestAttribute>('testSync', {
            email: {
              type: new DataTypes.STRING(),
              unique: true
            },
            phone: {
              type: new DataTypes.STRING(),
              unique: true
            }
          }, {
            indexes: [
              { name: 'wow_my_index', fields: ['email', 'phone'], unique: true }]
          });

          return User.sync({ force: true }).then(() => {
            return current.getQueryInterface().showIndex(User.getTableName());
          }).then(results => {
            if (dialect === 'sqlite') {
              // SQLite doesn't treat primary key as index
              expect(results).to.have.length(3);
            } else {
              expect(results).to.have.length(4);
              expect(results.filter(r => r.primary)).to.have.length(1);
            }

            expect(results.filter(r => r.unique === true && r.primary === false)).to.have.length(3);
            expect(results.filter(r => r.name === 'wow_my_index')).to.have.length(1);
          });
        });

        it('should create only one unique index for unique:name column', function() {
          const User = current.define<ItestInstance, ItestAttribute>('testSync', {
            email: {
              type: new DataTypes.STRING(),
              unique: 'wow_my_index'
            }
          });

          return User.sync({ force: true }).then(() => {
            return current.getQueryInterface().showIndex(User.getTableName());
          }).then(results => {
            if (dialect === 'sqlite') {
              // SQLite doesn't treat primary key as index
              expect(results).to.have.length(1);
            } else {
              expect(results).to.have.length(2);
              expect(results.filter(r => r.primary)).to.have.length(1);
            }

            expect(results.filter(r => r.unique === true && r.primary === false)).to.have.length(1);

            if (['postgres', 'sqlite'].indexOf(dialect) === -1) {
              // Postgres/SQLite doesn't support naming indexes in create table
              expect(results.filter(r => r.name === 'wow_my_index')).to.have.length(1);
            }
          });
        });

        it('should create only one unique index for unique:name columns', function() {
          const User = current.define<ItestInstance, ItestAttribute>('testSync', {
            email: {
              type: new DataTypes.STRING(),
              unique: 'wow_my_index'
            },
            phone: {
              type: new DataTypes.STRING(),
              unique: 'wow_my_index'
            }
          });

          return User.sync({ force: true }).then(() => {
            return current.getQueryInterface().showIndex(User.getTableName());
          }).then(results => {
            if (dialect === 'sqlite') {
              // SQLite doesn't treat primary key as index
              expect(results).to.have.length(1);
            } else {
              expect(results).to.have.length(2);
              expect(results.filter(r => r.primary)).to.have.length(1);
            }

            expect(results.filter(r => r.unique === true && r.primary === false)).to.have.length(1);
            if (['postgres', 'sqlite'].indexOf(dialect) === -1) {
              // Postgres/SQLite doesn't support naming indexes in create table
              expect(results.filter(r => r.name === 'wow_my_index')).to.have.length(1);
            }
          });
        });
      });
    }
  });
});

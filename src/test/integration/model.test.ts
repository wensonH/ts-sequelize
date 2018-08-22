'use strict';

import * as Promise from 'bluebird';
import * as chai from 'chai';
import * as _ from 'lodash';
import * as moment from 'moment';
import * as semver from 'semver';
import * as sinon from 'sinon';
import { Model } from '../..';
import DataTypes from '../../lib/data-types';
import { ItestAttribute, ItestInstance } from '../dummy/dummy-data-set';
import Support from './support';
const expect = chai.expect;
const dialect = Support.getTestDialect();
const current = Support.sequelize;
const Sequelize = Support.Sequelize;

describe(Support.getTestDialectTeaser('Model'), () => {
  let User : Model<ItestInstance, ItestAttribute>;
  let userKey : Model<ItestInstance, ItestAttribute>;
  let UserWithDec : Model<ItestInstance, ItestAttribute>;
  let UserWithAge : Model<ItestInstance, ItestAttribute>;
  let UserWithFields : Model<ItestInstance, ItestAttribute>;
  let UserPublic : Model<ItestInstance, ItestAttribute>;
  let UserSpecial : Model<ItestInstance, ItestAttribute>;
  let UserSpecialSync : Model<ItestInstance, ItestAttribute>;
  let Author : Model<ItestInstance, ItestAttribute>;
  let BlobUser : Model<ItestInstance, ItestAttribute>;
  let Project : Model<ItestInstance, ItestAttribute>;
  beforeEach(function() {
    User = current.define<ItestInstance, ItestAttribute>('User', {
      username: new DataTypes.STRING(),
      secretValue: new DataTypes.STRING(),
      data: new DataTypes.STRING(),
      intVal: new DataTypes.INTEGER(),
      theDate: new DataTypes.DATE(),
      aBool: new DataTypes.BOOLEAN()
    });

    return User.sync({ force: true });
  });

  describe('constructor', () => {
    it('uses the passed dao name as tablename if freezeTableName', function() {
      User = current.define<ItestInstance, ItestAttribute>('FrozenUser', {}, { freezeTableName: true });
      expect(User.tableName).to.equal('FrozenUser');
    });

    it('uses the pluralized dao name as tablename unless freezeTableName', function() {
      User = current.define<ItestInstance, ItestAttribute>('SuperUser', {}, { freezeTableName: false });
      expect(User.tableName).to.equal('SuperUsers');
    });

    it('uses checks to make sure dao factory isnt leaking on multiple define', function() {
      current.define<ItestInstance, ItestAttribute>('SuperUser', {}, { freezeTableName: false });
      const factorySize = current.modelManager.all.length;

      current.define<ItestInstance, ItestAttribute>('SuperUser', {}, { freezeTableName: false });
      const factorySize2 = current.modelManager.all.length;

      expect(factorySize).to.equal(factorySize2);
    });

    it('allows us us to predefine the ID column with our own specs', function() {
      User = current.define<ItestInstance, ItestAttribute>('UserCol', {
        id: {
          type: new DataTypes.STRING(),
          defaultValue: 'User',
          primaryKey: true
        }
      });

      return User.sync({ force: true }).then(() => {
        return expect(User.create({id: 'My own ID!'})).to.eventually.have.property('id', 'My own ID!');
      });
    });

    it('throws an error if 2 autoIncrements are passed', function() {
      expect(() => {
        current.define('UserWithTwoAutoIncrements', {
          userid: { type: new DataTypes.INTEGER(), primaryKey: true, autoIncrement: true },
          userscore: { type: new DataTypes.INTEGER(), primaryKey: true, autoIncrement: true }
        });
      }).to.throw(Error, 'Invalid Instance definition. Only one autoincrement field allowed.');
    });

    it('throws an error if a custom model-wide validation is not a function', function() {
      expect(() => {
        current.define('Foo', {
          field: new DataTypes.INTEGER()
        }, {
          validate: {
            notFunction: 33
          }
        });
      }).to.throw(Error, 'Members of the validate option must be functions. Model: Foo, error with validate member notFunction');
    });

    it('throws an error if a custom model-wide validation has the same name as a field', function() {
      expect(() => {
        current.define('Foo', {
          field: new DataTypes.INTEGER()
        }, {
          validate: {
            field() {}
          }
        });
      }).to.throw(Error, 'A model validator function must not have the same name as a field. Model: Foo, field/validation name: field');
    });

    it('should allow me to set a default value for createdAt and updatedAt', function() {
      const UserTable = current.define<ItestInstance, ItestAttribute>('UserCol', {
        aNumber: new DataTypes.INTEGER(),
        createdAt: {
          type: new DataTypes.DATE(),
          defaultValue: moment('2012-01-01').toDate()
        },
        updatedAt: {
          type: new DataTypes.DATE(),
          defaultValue: moment('2012-01-02').toDate()
        }
      }, { timestamps: true });

      return UserTable.sync({ force: true }).then(() => {
        return UserTable.create({aNumber: 5}).then(user => {
          return UserTable.bulkCreate([
            {aNumber: 10},
            {aNumber: 12},
          ]).then(() => {
            return UserTable.findAll({where: {aNumber: { gte: 10 }}}).then(users => {
              expect(moment(user.createdAt).format('YYYY-MM-DD')).to.equal('2012-01-01');
              expect(moment(user.updatedAt).format('YYYY-MM-DD')).to.equal('2012-01-02');
              users.forEach(u => {
                expect(moment(u.createdAt).format('YYYY-MM-DD')).to.equal('2012-01-01');
                expect(moment(u.updatedAt).format('YYYY-MM-DD')).to.equal('2012-01-02');
              });
            });
          });
        });
      });
    });

    it('should allow me to set a function as default value', function() {
      const defaultFunction = sinon.stub().returns(5);
      const UserTable = current.define<ItestInstance, ItestAttribute>('UserCol', {
        aNumber: {
          type: new DataTypes.INTEGER(),
          defaultValue: defaultFunction
        }
      }, { timestamps: true });

      return UserTable.sync({ force: true }).then(() => {
        return UserTable.create().then(user => {
          return UserTable.create().then(user2 => {
            expect(user.aNumber).to.equal(5);
            expect(user2.aNumber).to.equal(5);
            expect(defaultFunction.callCount).to.equal(2);
          });
        });
      });
    });

    it('should allow me to override updatedAt, createdAt, and deletedAt fields', function() {
      const UserTable = current.define<ItestInstance, ItestAttribute>('UserCol', {
        aNumber: new DataTypes.INTEGER()
      }, {
        timestamps: true,
        updatedAt: 'updatedOn',
        createdAt: 'dateCreated',
        deletedAt: 'deletedAtThisTime',
        paranoid: true
      });

      return UserTable.sync({force: true}).then(() => {
        return UserTable.create({aNumber: 4}).then(user => {
          expect(user.updatedOn).to.exist;
          expect(user.dateCreated).to.exist;
          return user.destroy().then(() => {
            return user.reload({ paranoid: false }).then(() => {
              expect(user.deletedAtThisTime).to.exist;
            });
          });
        });
      });
    });

    it('should allow me to disable some of the timestamp fields', function() {
      const UpdatingUser = current.define<ItestInstance, ItestAttribute>('UpdatingUser', {
        name: new DataTypes.STRING()
      }, {
        timestamps: true,
        updatedAt: false,
        createdAt: false,
        deletedAt: 'deletedAtThisTime',
        paranoid: true
      });

      return UpdatingUser.sync({force: true}).then(() => {
        return UpdatingUser.create({
          name: 'heyo'
        }).then(user => {
          expect(user.createdAt).not.to.exist;
          expect(user.false).not.to.exist; //  because, you know we might accidentally add a field named 'false'

          user.name = 'heho';
          return user.save().then(_user => {
            expect(_user.updatedAt).not.to.exist;
            return _user.destroy().then(() => {
              return _user.reload({ paranoid: false }).then(() => {
                expect(_user.deletedAtThisTime).to.exist;
              });
            });
          });
        });
      });
    });

    it('returns proper defaultValues after save when setter is set', function() {
      const titleSetter = sinon.spy();
      const Task = current.define<ItestInstance, ItestAttribute>('TaskBuild', {
        title: {
          type: new DataTypes.STRING(50),
          allowNull: false,
          defaultValue: ''
        }
      }, {
        setterMethods: {
          title: titleSetter
        }
      });

      return Task.sync({force: true}).then(() => {
        return Task.build().save().then(record => {
          expect(record.title).to.be.a('string');
          expect(record.title).to.equal('');
          expect(titleSetter.notCalled).to.be.ok; // The setter method should not be invoked for default values
        });
      });
    });

    it('should work with both paranoid and underscored being true', function() {
      const UserTable = current.define<ItestInstance, ItestAttribute>('UserCol', {
        aNumber: new DataTypes.INTEGER()
      }, {
        paranoid: true,
        underscored: true
      });

      return UserTable.sync({force: true}).then(() => {
        return UserTable.create({aNumber: 30}).then(() => {
          return UserTable.count().then(c => {
            expect(c).to.equal(1);
          });
        });
      });
    });

    it('allows multiple column unique keys to be defined', function() {
      User = current.define<ItestInstance, ItestAttribute>('UserWithUniqueUsername', {
        username: { type: new DataTypes.STRING(), unique: 'user_and_email' },
        email: { type: new DataTypes.STRING(), unique: 'user_and_email' },
        aCol: { type: new DataTypes.STRING(), unique: 'a_and_b' },
        bCol: { type: new DataTypes.STRING(), unique: 'a_and_b' }
      });

      return User.sync({ force: true, logging: _.after(2, _.once(sql => {
        if (dialect === 'mssql') {
          expect(sql).to.match(/CONSTRAINT\s*([`"\[]?user_and_email[`"\]]?)?\s*UNIQUE\s*\([`"\[]?username[`"\]]?, [`"\[]?email[`"\]]?\)/);
          expect(sql).to.match(/CONSTRAINT\s*([`"\[]?a_and_b[`"\]]?)?\s*UNIQUE\s*\([`"\[]?aCol[`"\]]?, [`"\[]?bCol[`"\]]?\)/);
        } else {
          expect(sql).to.match(/UNIQUE\s*([`"]?user_and_email[`"]?)?\s*\([`"]?username[`"]?, [`"]?email[`"]?\)/);
          expect(sql).to.match(/UNIQUE\s*([`"]?a_and_b[`"]?)?\s*\([`"]?aCol[`"]?, [`"]?bCol[`"]?\)/);
        }
      }))});
    });

    it('allows unique on column with field aliases', function() {
      User = current.define<ItestInstance, ItestAttribute>('UserWithUniqueFieldAlias', {
        userName: { type: new DataTypes.STRING(), unique: 'user_name_unique', field: 'user_name' }
      });
      return User.sync({ force: true }).bind(this).then(function() {
        return current.queryInterface.showIndex(User.tableName).then(indexes => {
          let idxUnique;
          if (dialect === 'sqlite') {
            expect(indexes).to.have.length(1);
            idxUnique = indexes[0];
            expect(idxUnique.primary).to.equal(false);
            expect(idxUnique.unique).to.equal(true);
            expect(idxUnique.fields).to.deep.equal([{attribute: 'user_name', length: undefined, order: undefined}]);
          } else if (dialect === 'mysql') {
            expect(indexes).to.have.length(2);
            idxUnique = indexes[1];
            expect(idxUnique.primary).to.equal(false);
            expect(idxUnique.unique).to.equal(true);
            expect(idxUnique.fields).to.deep.equal([{attribute: 'user_name', length: undefined, order: 'ASC'}]);
            expect(idxUnique.type).to.equal('BTREE');
          } else if (dialect === 'postgres') {
            expect(indexes).to.have.length(2);
            idxUnique = indexes[1];
            expect(idxUnique.primary).to.equal(false);
            expect(idxUnique.unique).to.equal(true);
            expect(idxUnique.fields).to.deep.equal([{attribute: 'user_name', collate: undefined, order: undefined, length: undefined}]);
          } else if (dialect === 'mssql') {
            expect(indexes).to.have.length(2);
            idxUnique = indexes[1];
            expect(idxUnique.primary).to.equal(false);
            expect(idxUnique.unique).to.equal(true);
            expect(idxUnique.fields).to.deep.equal([{attribute: 'user_name', collate: undefined, length: undefined, order: 'ASC'}]);
          } else if (dialect === 'oracle') {
            expect(indexes).to.have.length(2);
            idxUnique = indexes[1];
            expect(idxUnique.primary).to.equal(false);
            expect(idxUnique.unique).to.equal(true);
            expect(idxUnique.fields).to.deep.equal([{attribute: 'USER_NAME', length: undefined, collate: undefined, order: 'ASC'}]);
          }
        });
      });
    });


    if (dialect !== 'oracle') {
      //As it produces a fake error randomly with those two tests, for Oracle, I decided to skip it
      it('allows us to customize the error message for unique constraint', function() {

        User = current.define<ItestInstance, ItestAttribute>('UserWithUniqueUsername', {
          username: { type: new DataTypes.STRING(), unique: { name: 'user_and_email', msg: 'User and email must be unique' }},
          email: { type: new DataTypes.STRING(), unique: 'user_and_email' }
        });

        return User.sync({ force: true }).bind(this).then(() => {
          return current.Promise.all([
            User.create({username: 'tobi', email: 'tobi@tobi.me'}),
            User.create({username: 'tobi', email: 'tobi@tobi.me'})]);
        }).catch (current.UniqueConstraintError, err => {
          expect(err.message).to.equal('User and email must be unique');
          return true;
        });
      });

      // If you use migrations to create unique indexes that have explicit names and/or contain fields
      // that have underscore in their name. Then sequelize must use the index name to map the custom message to the error thrown from db.
      it('allows us to map the customized error message with unique constraint name', function() {
        // Fake migration style index creation with explicit index definition
        User = current.define<ItestInstance, ItestAttribute>('UserWithUniqueUsername', {
          user_id: { type: new DataTypes.INTEGER()},
          email: { type: new DataTypes.STRING()}
        }, {
          indexes: [
            {
              name: 'user_and_email_index',
              msg: 'User and email must be unique',
              unique: true,
              method: 'BTREE',
              fields: ['user_id', {attribute: 'email', collate: dialect === 'sqlite' ? 'RTRIM' : 'en_US', order: 'DESC', length: 5}]
            }]
        });

        return User.sync({ force: true }).bind(this).then(() => {
          // Redefine the model to use the index in database and override error message
          User = current.define('UserWithUniqueUsername', {
            user_id: { type: new DataTypes.INTEGER(), unique: { name: 'user_and_email_index', msg: 'User and email must be unique' }},
            email: { type: new DataTypes.STRING(), unique: 'user_and_email_index'}
          });
          return current.Promise.all([
            User.create({user_id: 1, email: 'tobi@tobi.me'}),
            User.create({user_id: 1, email: 'tobi@tobi.me'})]);
        }).catch (current.UniqueConstraintError, err => {
          expect(err.message).to.equal('User and email must be unique');
          return true;
        });
      });
    }


    it('should allow the user to specify indexes in options', function() {
      this.retries(3);
      const indices : Array<{
        name? : string,
        type? : string,
        unique? : boolean,
        method? : string,
        fields? : any[],
        concurrently? : boolean,
      }> = [{
        name: 'a_b_uniq',
        unique: true,
        method: 'BTREE',
        fields: ['fieldB', {attribute: 'fieldA', collate: dialect === 'sqlite' ? 'RTRIM' : 'en_US', order: 'DESC', length: 5}]
      }];

      if (dialect !== 'mssql') {
        indices.push({
          type: 'FULLTEXT',
          fields: ['fieldC'],
          concurrently: true
        });

        indices.push({
          type: 'FULLTEXT',
          fields: ['fieldD']
        });
      }

      const _Model = current.define<ItestInstance, ItestAttribute>('model', {
        fieldA: new DataTypes.STRING(),
        fieldB: new DataTypes.INTEGER(),
        fieldC: new DataTypes.STRING(),
        fieldD: new DataTypes.STRING()
      }, {
        indexes: indices,
        engine: 'MyISAM'
      });

      return current.sync().bind(this).then(function() {
        return current.sync(); // The second call should not try to create the indices again
      }).then(function() {
        return current.queryInterface.showIndex(_Model.tableName);
      }).spread(function() {
        let primary;
        let idx1;
        let idx2;
        let idx3;

        if (dialect === 'sqlite') {
          // PRAGMA index_info does not return the primary index
          idx1 = arguments[0];
          idx2 = arguments[1];

          expect(idx1.fields).to.deep.equal([
            { attribute: 'fieldB', length: undefined, order: undefined},
            { attribute: 'fieldA', length: undefined, order: undefined},
          ]);

          expect(idx2.fields).to.deep.equal([
            { attribute: 'fieldC', length: undefined, order: undefined},
          ]);
        } else if (dialect === 'oracle') {
          idx1 = arguments[0];
          idx2 = arguments[1];


          expect(idx1.fields).to.deep.equal([
            { attribute: 'FIELDA', collate: undefined, length: undefined, order: 'ASC'},
            //As it has been created as an unique constraint, the index is ASC
            { attribute: 'FIELDB', collate: undefined, length: undefined, order: 'ASC'},
          ]);

          expect(idx2.fields).to.deep.equal([
            { attribute: 'FIELDC', collate: undefined, length: undefined, order: 'ASC'},
          ]);
        } else if (dialect === 'mssql') {
          idx1 = arguments[0];

          expect(idx1.fields).to.deep.equal([
            { attribute: 'fieldB', length: undefined, order: 'ASC', collate: undefined},
            { attribute: 'fieldA', length: undefined, order: 'DESC', collate: undefined},
          ]);
        } else if (dialect === 'postgres') {
          // Postgres returns indexes in alphabetical order
          primary = arguments[2];
          idx1 = arguments[0];
          idx2 = arguments[1];
          idx3 = arguments[2];

          expect(idx1.fields).to.deep.equal([
            { attribute: 'fieldB', length: undefined, order: undefined, collate: undefined},
            { attribute: 'fieldA', length: undefined, order: 'DESC', collate: 'en_US'},
          ]);

          expect(idx2.fields).to.deep.equal([
            { attribute: 'fieldC', length: undefined, order: undefined, collate: undefined},
          ]);

          expect(idx3.fields).to.deep.equal([
            { attribute: 'fieldD', length: undefined, order: undefined, collate: undefined},
          ]);
        } else {
          // And finally mysql returns the primary first, and then the rest in the order they were defined
          primary = arguments[0];
          idx1 = arguments[1];
          idx2 = arguments[2];

          expect(primary.primary).to.be.ok;

          expect(idx1.type).to.equal('BTREE');
          expect(idx2.type).to.equal('FULLTEXT');

          expect(idx1.fields).to.deep.equal([
            { attribute: 'fieldB', length: undefined, order: 'ASC'},
            { attribute: 'fieldA', length: 5, order: 'ASC'},
          ]);

          expect(idx2.fields).to.deep.equal([
            { attribute: 'fieldC', length: undefined, order: undefined},
          ]);
        }

        expect(idx1.name).to.equal('a_b_uniq');
        expect(idx1.unique).to.be.ok;

        if (dialect !== 'mssql') {
          expect(idx2.name).to.equal('models_field_c');
          expect(idx2.unique).not.to.be.ok;
        }
      });
    });
  });

  describe('build', () => {
    it("doesn't create database entries", function() {
      User.build({ username: 'John Wayne' });
      return User.findAll().then(users => {
        expect(users).to.have.length(0);
      });
    });

    it('fills the objects with default values', function() {
      const Task = current.define<ItestInstance, ItestAttribute>('TaskBuild', {
        title: {type: new DataTypes.STRING(), defaultValue: 'a task!'},
        foo: {type: new DataTypes.INTEGER(), defaultValue: 2},
        bar: {type: new DataTypes.DATE()},
        foobar: {type: new DataTypes.TEXT(), defaultValue: 'asd'},
        flag: {type: new DataTypes.BOOLEAN(), defaultValue: false}
      });

      expect(Task.build().title).to.equal('a task!');
      expect(Task.build().foo).to.equal(2);
      expect(Task.build().bar).to.not.be.ok;
      expect(Task.build().foobar).to.equal('asd');
      expect(Task.build().flag).to.be.false;
    });

    it('fills the objects with default values', function() {
      const Task = current.define<ItestInstance, ItestAttribute>('TaskBuild', {
        title: {type: new DataTypes.STRING(), defaultValue: 'a task!'},
        foo: {type: new DataTypes.INTEGER(), defaultValue: 2},
        bar: {type: new DataTypes.DATE()},
        foobar: {type: new DataTypes.TEXT(), defaultValue: 'asd'},
        flag: {type: new DataTypes.BOOLEAN(), defaultValue: false}
      }, { timestamps: false });
      expect(Task.build().title).to.equal('a task!');
      expect(Task.build().foo).to.equal(2);
      expect(Task.build().bar).to.not.be.ok;
      expect(Task.build().foobar).to.equal('asd');
      expect(Task.build().flag).to.be.false;
    });

    it('attaches getter and setter methods from attribute definition', function() {
      const Product = current.define<ItestInstance, ItestAttribute>('ProductWithSettersAndGetters1', {
        price: {
          type: new DataTypes.INTEGER(),
          get() {
            return 'answer = ' + this.getDataValue('price');
          },
          set(v) {
            return this.setDataValue('price', v + 42);
          }
        }
      });

      expect(Product.build({price: 42}).price).to.equal('answer = 84');

      const p = Product.build({price: 1});
      expect(p.price).to.equal('answer = 43');

      p.price = 0;
      expect(p.price).to.equal('answer = 42');
    });

    it('attaches getter and setter methods from options', function() {
      const Product = current.define<ItestInstance, ItestAttribute>('ProductWithSettersAndGetters2', {
        priceInCents: new DataTypes.INTEGER()
      }, {
        setterMethods: {
          price(value) {
            this.dataValues.priceInCents = value * 100;
          }
        },
        getterMethods: {
          price() {
            return '$' + this.getDataValue('priceInCents') / 100;
          },

          priceInCents() {
            return this.dataValues.priceInCents;
          }
        }
      });

      expect(Product.build({price: 20}).priceInCents).to.equal(20 * 100);
      expect(Product.build({priceInCents: 30 * 100}).price).to.equal('$' + 30);
    });

    it('attaches getter and setter methods from options only if not defined in attribute', function() {
      const Product = current.define<ItestInstance, ItestAttribute>('ProductWithSettersAndGetters3', {
        price1: {
          type: new DataTypes.INTEGER(),
          set(v) { this.setDataValue('price1', v * 10); }
        },
        price2: {
          type: new DataTypes.INTEGER(),
          get() { return this.getDataValue('price2') * 10; }
        }
      }, {
        setterMethods: {
          price1(v) { this.setDataValue('price1', v * 100); }
        },
        getterMethods: {
          price2() { return '$' + this.getDataValue('price2'); }
        }
      });

      const p = Product.build({ price1: 1, price2: 2 });

      expect(p.price1).to.equal(10);
      expect(p.price2).to.equal(20);
    });

    describe('include', () => {
      it('should support basic includes', function() {
        const Product = current.define<ItestInstance, ItestAttribute>('Product', {
          title: new DataTypes.STRING()
        });
        const Tag = current.define<ItestInstance, ItestAttribute>('Tag', {
          name: new DataTypes.STRING()
        });
        User = current.define<ItestInstance, ItestAttribute>('User', {
          first_name: new DataTypes.STRING(),
          last_name: new DataTypes.STRING()
        });

        Product.hasMany(Tag);
        Product.belongsTo(User);

        const product = Product.build({
          id: 1,
          title: 'Chair',
          Tags: [
            {id: 1, name: 'Alpha'},
            {id: 2, name: 'Beta'},
          ],
          User: {
            id: 1,
            first_name: 'Mick',
            last_name: 'Hansen'
          }
        }, {
          include: [
            User,
            Tag,
          ]
        });

        expect(product.Tags).to.be.ok;
        expect(product.Tags.length).to.equal(2);
        expect(product.Tags[0].model).to.equal(Tag);
        expect(product.User).to.be.ok;
        expect(product.User.model).to.equal(User);
      });

      it('should support includes with aliases', function() {
        const Product = current.define<ItestInstance, ItestAttribute>('Product', {
          title: new DataTypes.STRING()
        });
        const Tag = current.define<ItestInstance, ItestAttribute>('Tag', {
          name: new DataTypes.STRING()
        });
        User = current.define<ItestInstance, ItestAttribute>('User', {
          first_name: new DataTypes.STRING(),
          last_name: new DataTypes.STRING()
        });

        Product.hasMany(Tag, {as: 'categories'});
        Product.belongsToMany(User, {as: 'followers', through: 'product_followers'});
        User.belongsToMany(Product, {as: 'following', through: 'product_followers'});

        const product = Product.build({
          id: 1,
          title: 'Chair',
          categories: [
            {id: 1, name: 'Alpha'},
            {id: 2, name: 'Beta'},
            {id: 3, name: 'Charlie'},
            {id: 4, name: 'Delta'},
          ],
          followers: [
            {
              id: 1,
              first_name: 'Mick',
              last_name: 'Hansen'
            },
            {
              id: 2,
              first_name: 'Jan',
              last_name: 'Meier'
            },
          ]
        }, {
          include: [
            {model: User, as: 'followers'},
            {model: Tag, as: 'categories'},
          ]
        });

        expect(product.categories).to.be.ok;
        expect(product.categories.length).to.equal(4);
        expect(product.categories[0].model).to.equal(Tag);
        expect(product.followers).to.be.ok;
        expect(product.followers.length).to.equal(2);
        expect(product.followers[0].model).to.equal(User);
      });
    });
  });

  describe('findOne', () => {
    if (current.dialect.supports.transactions) {
      it('supports the transaction option in the first parameter', function() {
        return Support.prepareTransactionTest(current).bind({}).then(sequelize => {
          User = sequelize.define('User', { username: new DataTypes.STRING(), foo: new DataTypes.STRING() });
          return User.sync({ force: true }).then(() => {
            return sequelize.transaction().then(t => {
              return User.create({ username: 'foo' }, { transaction: t }).then(() => {
                return User.findOne({ where: { username: 'foo' }, transaction: t }).then(user => {
                  expect(user).to.not.be.null;
                  return t.rollback();
                });
              });
            });
          });
        });
      });
    }

    it('should not fail if model is paranoid and where is an empty array', function() {
      User = current.define<ItestInstance, ItestAttribute>('User', { username: new DataTypes.STRING() }, { paranoid: true });

      return User.sync({ force: true })
        .then(() => {
          return User.create({ username: 'A fancy name' });
        })
        .then(() => {
          return User.findOne({ where: [] });
        })
        .then(u => {
          expect(u.username).to.equal('A fancy name');
        });
    });

    // https://github.com/sequelize/sequelize/issues/8406
    it('should work if model is paranoid and only operator in where clause is a Symbol', function() {
      User = current.define<ItestInstance, ItestAttribute>('User', { username: new DataTypes.STRING() }, { paranoid: true } );

      return User.sync({ force: true})
        .then(() => {
          return User.create({ username: 'foo' });
        })
        .then(() => {
          return User.findOne({
            where: {
              [Sequelize.Op.or]: [
                { username: 'bar' },
                { username: 'baz' },
              ]
            }
          });
        })
        .then(user => {
          expect(user).to.not.be.ok;
        });
    });
  });

  describe('findOrInitialize', () => {

    if (current.dialect.supports.transactions) {
      it('supports transactions', function() {
        return Support.prepareTransactionTest(current).bind({}).then(sequelize => {
          User = sequelize.define('User', { username: new DataTypes.STRING(), foo: new DataTypes.STRING() });

          return User.sync({ force: true }).then(() => {
            return sequelize.transaction().then(t => {
              return User.create({ username: 'foo' }, { transaction: t }).then(() => {
                return User.findOrInitialize({
                  where: {username: 'foo'}
                }).spread(user1 => {
                  return User.findOrInitialize({
                    where: {username: 'foo'},
                    transaction: t
                  }).spread(user2 => {
                    return User.findOrInitialize({
                      where: {username: 'foo'},
                      defaults: { foo: 'asd' },
                      transaction: t
                    }).spread(user3 => {
                      expect(user1.isNewRecord).to.be.true;
                      expect(user2.isNewRecord).to.be.false;
                      expect(user3.isNewRecord).to.be.false;
                      return t.commit();
                    });
                  });
                });
              });
            });
          });
        });
      });
    }

    describe('returns an instance if it already exists', () => {
      it('with a single find field', function() {
        return User.create({ username: 'Username' }).then(user => {
          return User.findOrInitialize({
            where: { username: user.username }
          }).spread((_user, initialized) => {
            expect(_user.id).to.equal(user.id);
            expect(_user.username).to.equal('Username');
            expect(initialized).to.be.false;
          });
        });
      });

      it('with multiple find fields', function() {
        return User.create({ username: 'Username', data: 'data' }).then(user => {
          return User.findOrInitialize({ where: {
            username: user.username,
            data: user.data
          }}).spread((_user, initialized) => {
            expect(_user.id).to.equal(user.id);
            expect(_user.username).to.equal('Username');
            expect(_user.data).to.equal('data');
            expect(initialized).to.be.false;
          });
        });
      });

      it('builds a new instance with default value.', function() {
        const data = {
          username: 'Username'
        };
        const default_values = {
          data: 'ThisIsData'
        };

        return User.findOrInitialize({
          where: data,
          defaults: default_values
        }).spread((user, initialized) => {
          expect(user.id).to.be.null;
          expect(user.username).to.equal('Username');
          expect(user.data).to.equal('ThisIsData');
          expect(initialized).to.be.true;
          expect(user.isNewRecord).to.be.true;
        });
      });
    });
  });

  describe('update', () => {
    it('throws an error if no where clause is given', function() {
      User = current.define<ItestInstance, ItestAttribute>('User', { username: new DataTypes.STRING() });

      return current.sync({ force: true }).then(() => {
        return User.update();
      }).then(() => {
        throw new Error('Update should throw an error if no where clause is given.');
      }, err => {
        expect(err).to.be.an.instanceof(Error);
        expect(err.message).to.equal('Missing where attribute in the options parameter');
      });
    });

    if (current.dialect.supports.transactions) {
      it('supports transactions', function() {
        return Support.prepareTransactionTest(current).bind({}).then(sequelize => {
          User = sequelize.define('User', { username: new DataTypes.STRING() });

          return User.sync({ force: true }).then(() => {
            return User.create({ username: 'foo' }).then(() => {
              return sequelize.transaction().then(t => {
                return User.update({ username: 'bar' }, {where: {username: 'foo'}, transaction: t }).then(() => {
                  return User.findAll().then(users1 => {
                    return User.findAll({ transaction: t }).then(users2 => {
                      expect(users1[0].username).to.equal('foo');
                      expect(users2[0].username).to.equal('bar');
                      return t.rollback();
                    });
                  });
                });
              });
            });
          });
        });
      });
    }

    it('updates the attributes that we select only without updating createdAt', function() {
      User = current.define<ItestInstance, ItestAttribute>('User1', {
        username: new DataTypes.STRING(),
        secretValue: new DataTypes.STRING()
      }, {
        paranoid: true
      });
      let test = false;
      return User.sync({ force: true }).then(() => {
        return User.create({username: 'Peter', secretValue: '42'}).then(user => {
          return user.updateAttributes({ secretValue: '43' }, {
            fields: ['secretValue'], logging(sql) {
              test = true;
              if (dialect === 'mssql') {
                expect(sql).to.not.contain('createdAt');
              } else if (dialect === 'oracle') {
                expect(sql).to.match(/UPDATE User1s SET secretValue=:updatesecretValue1,updatedAt=TO_TIMESTAMP_TZ\('([0-9-+:. ]*)','YYYY-MM-DD HH24:MI:SS.FFTZH:TZM'\) WHERE id = :whereid1/);
              } else {
                expect(sql).to.match(/UPDATE\s+[`"]+User1s[`"]+\s+SET\s+[`"]+secretValue[`"]=(\$1|\?),[`"]+updatedAt[`"]+=(\$2|\?)\s+WHERE [`"]+id[`"]+\s=\s(\$3|\?)/);
              }
            }
          });
        });
      }).then(() => {
        expect(test).to.be.true;
      });
    });

    it('allows sql logging of updated statements', function() {
      User = current.define<ItestInstance, ItestAttribute>('User', {
        name: new DataTypes.STRING(),
        bio: new DataTypes.TEXT()
      }, {
        paranoid: true
      });
      let test = false;
      return User.sync({ force: true }).then(() => {
        return User.create({ name: 'meg', bio: 'none' }).then(u => {
          expect(u).to.exist;
          return u.updateAttributes({name: 'brian'}, {
            logging(sql) {
              test = true;
              expect(sql).to.exist;
              expect(sql.toUpperCase().indexOf('UPDATE')).to.be.above(-1);
            }
          });
        });
      }).then(() => {
        expect(test).to.be.true;
      });
    });

    it('updates only values that match filter', function() {
      const data = [{ username: 'Peter', secretValue: '42' },
          { username: 'Paul', secretValue: '42' },
          { username: 'Bob', secretValue: '43' }];

      return User.bulkCreate(data).then(() => {
        return User.update({username: 'Bill'}, {where: {secretValue: '42'}}).then(() => {
          return User.findAll({order: ['id']}).then(users => {
            expect(users.length).to.equal(3);

            users.forEach(user => {
              if (user.secretValue === '42') {
                expect(user.username).to.equal('Bill');
              } else {
                expect(user.username).to.equal('Bob');
              }
            });

          });
        });
      });
    });

    it('updates only values that match the allowed fields', function() {
      const data = [{ username: 'Peter', secretValue: '42' }];

      return User.bulkCreate(data).then(() => {
        return User.update({username: 'Bill', secretValue: '43'}, {where: {secretValue: '42'}, fields: ['username']}).then(() => {
          return User.findAll({order: ['id']}).then(users => {
            expect(users.length).to.equal(1);

            const user = users[0];
            expect(user.username).to.equal('Bill');
            expect(user.secretValue).to.equal('42');
          });
        });
      });
    });

    it('updates with casting', function() {
      return User.create({
        username: 'John'
      }).then(() => {
        return User.update({username: current.cast('1', dialect === 'mssql' ? 'nvarchar' : 'char')}, {where: {username: 'John'}}).then(() => {
          return User.findAll().then(users => {
            expect(users[0].username).to.equal('1');
          });
        });
      });
    });

    it('updates with function and column value', function() {
      return User.create({
        username: 'John'
      }).then(() => {
        return User.update({username: current.fn('upper', current.col('username'))}, {where: {username: 'John'}}).then(() => {
          return User.findAll().then(users => {
            expect(users[0].username).to.equal('JOHN');
          });
        });
      });
    });

    it('does not update virtual attributes', function() {
      User = current.define<ItestInstance, ItestAttribute>('User', {
        username: new DataTypes.STRING(),
        virtual: new DataTypes.VIRTUAL()
      });

      return User.create({
        username: 'jan'
      }).then(() => {
        return User.update({
          username: 'kurt',
          virtual: 'test'
        }, {
          where: {
            username: 'jan'
          }
        });
      }).then(() => {
        return User.findAll();
      }).spread(user => {
        expect(user.username).to.equal('kurt');
      });
    });

    it('doesn\'t update attributes that are altered by virtual setters when option is enabled', function() {
      User = current.define<ItestInstance, ItestAttribute>('UserWithVirtualSetters', {
        username: new DataTypes.STRING(),
        illness_name: new DataTypes.STRING(),
        illness_pain: new DataTypes.INTEGER(),
        illness: {
          type: new DataTypes.VIRTUAL(),
          set(value) {
            this.set('illness_name', value.name);
            this.set('illness_pain', value.pain);
          }
        }
      });

      return User.sync({ force: true }).then(() => {
        return User.create({
          username: 'Jan',
          illness_name: 'Headache',
          illness_pain: 5
        });
      }).then(() => {
        return User.update({
          illness: { pain: 10, name: 'Backache' }
        }, {
          where: {
            username: 'Jan'
          },
          sideEffects: false
        });
      }).then(() => {
        return User.findAll();
      }).spread(user => {
        expect(user.illness_pain).to.be.equal(5);
      });
    });

    it('updates attributes that are altered by virtual setters', function() {
      User = current.define<ItestInstance, ItestAttribute>('UserWithVirtualSetters', {
        username: new DataTypes.STRING(),
        illness_name: new DataTypes.STRING(),
        illness_pain: new DataTypes.INTEGER(),
        illness: {
          type: new DataTypes.VIRTUAL(),
          set(value) {
            this.set('illness_name', value.name);
            this.set('illness_pain', value.pain);
          }
        }
      });

      return User.sync({ force: true }).then(() => {
        return User.create({
          username: 'Jan',
          illness_name: 'Headache',
          illness_pain: 5
        });
      }).then(() => {
        return User.update({
          illness: { pain: 10, name: 'Backache' }
        }, {
          where: {
            username: 'Jan'
          }
        });
      }).then(() => {
        return User.findAll();
      }).spread(user => {
        expect(user.illness_pain).to.be.equal(10);
      });
    });

    it('should properly set data when individualHooks are true', function() {
      User.beforeUpdate(instance => {
        instance.set('intVal', 1);
      });

      return User.create({ username: 'Peter' }).then(user => {
        return User.update({ data: 'test' }, { where: { id: user.id }, individualHooks: true }).then(() => {
          return User.findById(user.id).then(userUpdated => {
            expect(userUpdated.intVal).to.be.equal(1);
          });
        });
      });
    });

    it('sets updatedAt to the current timestamp', function() {
      const data = [{ username: 'Peter', secretValue: '42' },
        { username: 'Paul', secretValue: '42' },
        { username: 'Bob', secretValue: '43' }];

      return User.bulkCreate(data).bind(this).then(function() {
        return User.findAll({order: ['id']});
      }).then(function(users) {
        this.updatedAt = users[0].updatedAt;

        expect(this.updatedAt).to.be.ok;
        expect(this.updatedAt).to.equalTime(users[2].updatedAt); // All users should have the same updatedAt

        // Pass the time so we can actually see a change
        return Promise.delay(1000).then(() => {
          return User.update({username: 'Bill'}, {where: {secretValue: '42'}});
        }).then(() => {
          return User.findAll({order: ['id']});
        }).then(users2 => {
          expect(users2[0].username).to.equal('Bill');
          expect(users2[1].username).to.equal('Bill');
          expect(users2[2].username).to.equal('Bob');

          expect(users2[0].updatedAt).to.be.afterTime(this.updatedAt);
          expect(users2[2].updatedAt).to.equalTime(this.updatedAt);
        });
      });
    });

    it('returns the number of affected rows', function() {
      const data = [{ username: 'Peter', secretValue: '42' },
          { username: 'Paul', secretValue: '42' },
          { username: 'Bob', secretValue: '43' }];

      return User.bulkCreate(data).then(() => {
        return User.update({username: 'Bill'}, {where: {secretValue: '42'}}).spread(affectedRows => {
          expect(affectedRows).to.equal(2);
        }).then(() => {
          return User.update({username: 'Bill'}, {where: {secretValue: '44'}}).spread(affectedRows => {
            expect(affectedRows).to.equal(0);
          });
        });
      });
    });

    it('does not update soft deleted records when model is paranoid', function() {
      const ParanoidUser = current.define<ItestInstance, ItestAttribute>('ParanoidUser', { username: new DataTypes.STRING() }, { paranoid: true });

      return current.sync({ force: true }).then(() => {
        return ParanoidUser.bulkCreate([
          { username: 'user1' },
          { username: 'user2' },
        ]);
      }).then(() => {
        return ParanoidUser.destroy({
          where: {
            username: 'user1'
          }
        });
      }).then(() => {
        return ParanoidUser.update({ username: 'foo' }, {
          where: {}
        });
      }).then(() => {
        return ParanoidUser.findAll({
          paranoid: false,
          where: {
            username: 'foo'
          }
        });
      }).then(users => {
        expect(users).to.have.lengthOf(1, 'should not update soft-deleted record');
      });
    });

    it('updates soft deleted records when paranoid is overridden', function() {
      const ParanoidUser = current.define<ItestInstance, ItestAttribute>('ParanoidUser', { username: new DataTypes.STRING() }, { paranoid: true });

      return current.sync({ force: true }).then(() => {
        return ParanoidUser.bulkCreate([
          { username: 'user1' },
          { username: 'user2' },
        ]);
      }).then(() => {
        return ParanoidUser.destroy({
          where: {
            username: 'user1'
          }
        });
      }).then(() => {
        return ParanoidUser.update({ username: 'foo' }, {
          where: {},
          paranoid: false
        });
      }).then(() => {
        return ParanoidUser.findAll({
          paranoid: false,
          where: {
            username: 'foo'
          }
        });
      }).then(users => {
        expect(users).to.have.lengthOf(2);
      });
    });

    if (dialect === 'postgres') {
      it('returns the affected rows if `options.returning` is true', function() {
        const data = [{ username: 'Peter', secretValue: '42' },
            { username: 'Paul', secretValue: '42' },
            { username: 'Bob', secretValue: '43' }];

        return User.bulkCreate(data).then(() => {
          return User.update({ username: 'Bill' }, { where: {secretValue: '42' }, returning: true }).spread((count, rows) => {
            expect(count).to.equal(2);
            expect(rows).to.have.length(2);
          }).then(() => {
            return User.update({ username: 'Bill'}, { where: {secretValue: '44' }, returning: true }).spread((count, rows) => {
              expect(count).to.equal(0);
              expect(rows).to.have.length(0);
            });
          });
        });
      });
    }

    if (dialect === 'mysql') {
      it('supports limit clause', function() {
        const data = [{ username: 'Peter', secretValue: '42' },
            { username: 'Peter', secretValue: '42' },
            { username: 'Peter', secretValue: '42' }];

        return User.bulkCreate(data).then(() => {
          return User.update({secretValue: '43'}, {where: {username: 'Peter'}, limit: 1}).spread(affectedRows => {
            expect(affectedRows).to.equal(1);
          });
        });
      });
    }

  });

  describe('destroy', () => {
    it('convenient method `truncate` should clear the table', function() {
      User = current.define<ItestInstance, ItestAttribute>('User', { username: new DataTypes.STRING() });
      const data = [
        { username: 'user1' },
        { username: 'user2' },
      ];

      return current.sync({ force: true }).then(() => {
        return User.bulkCreate(data);
      }).then(() => {
        return User.truncate();
      }).then(() => {
        return expect(User.findAll()).to.eventually.have.length(0);
      });
    });

    it('truncate should clear the table', function() {
      User = current.define<ItestInstance, ItestAttribute>('User', { username: new DataTypes.STRING() });
      const data = [
        { username: 'user1' },
        { username: 'user2' },
      ];

      return current.sync({ force: true }).then(() => {
        return User.bulkCreate(data);
      }).then(() => {
        return User.destroy({ truncate: true });
      }).then(() => {
        return expect(User.findAll()).to.eventually.have.length(0);
      });
    });

    it('throws an error if no where clause is given', function() {
      User = current.define<ItestInstance, ItestAttribute>('User', { username: new DataTypes.STRING() });

      return current.sync({ force: true }).then(() => {
        return User.destroy();
      }).then(() => {
        throw new Error('Destroy should throw an error if no where clause is given.');
      }, err => {
        expect(err).to.be.an.instanceof(Error);
        expect(err.message).to.equal('Missing where or truncate attribute in the options parameter of model.destroy.');
      });
    });

    it('deletes all instances when given an empty where object', function() {
      User = current.define<ItestInstance, ItestAttribute>('User', { username: new DataTypes.STRING() });
      const data = [
        { username: 'user1' },
        { username: 'user2' },
      ];

      return current.sync({ force: true }).then(() => {
        return User.bulkCreate(data);
      }).then(() => {
        return User.destroy({ where: {} });
      }).then(affectedRows => {
        expect(affectedRows).to.equal(2);
        return User.findAll();
      }).then(users => {
        expect(users).to.have.length(0);
      });
    });

    if (current.dialect.supports.transactions) {
      it('supports transactions', function() {
        return Support.prepareTransactionTest(current).bind({}).then(sequelize => {
          User = sequelize.define('User', { username: new DataTypes.STRING() });

          return User.sync({ force: true }).then(() => {
            return User.create({ username: 'foo' }).then(() => {
              return sequelize.transaction().then(t => {
                return User.destroy({
                  where: {},
                  transaction: t
                }).then(() => {
                  return User.count().then(count1 => {
                    return User.count({ transaction: t }).then(count2 => {
                      expect(count1).to.equal(1);
                      expect(count2).to.equal(0);
                      return t.rollback();
                    }).catch(err => {
                      t.rollback();
                      throw err;
                    });
                  });
                });
              });
            });
          });
        });
      });
    }

    it('deletes values that match filter', function() {
      const data = [{ username: 'Peter', secretValue: '42' },
          { username: 'Paul', secretValue: '42' },
          { username: 'Bob', secretValue: '43' }];

      return User.bulkCreate(data).then(() => {
        return User.destroy({where: {secretValue: '42'}})
          .then(() => {
            return User.findAll({order: ['id']}).then(users => {
              expect(users.length).to.equal(1);
              expect(users[0].username).to.equal('Bob');
            });
          });
      });
    });

    it('works without a primary key', function() {
      const Log = current.define<ItestInstance, ItestAttribute>('Log', {
        client_id: new DataTypes.INTEGER(),
        content: new DataTypes.TEXT(),
        timestamp: new DataTypes.DATE()
      });
      Log.removeAttribute('id');

      return Log.sync({force: true}).then(() => {
        return Log.create({
          client_id: 13,
          content: 'Error!',
          timestamp: new Date()
        });
      }).then(() => {
        return Log.destroy({
          where: {
            client_id: 13
          }
        });
      }).then(() => {
        return Log.findAll().then(logs => {
          expect(logs.length).to.equal(0);
        });
      });
    });

    it('supports .field', function() {
      const UserProject = current.define<ItestInstance, ItestAttribute>('UserProject', {
        userId: {
          type: new DataTypes.INTEGER(),
          field: 'user_id'
        }
      });

      return UserProject.sync({force: true}).then(() => {
        return UserProject.create({
          userId: 10
        });
      }).then(() => {
        return UserProject.destroy({
          where: {
            userId: 10
          }
        });
      }).then(() => {
        return UserProject.findAll();
      }).then(userProjects => {
        expect(userProjects.length).to.equal(0);
      });
    });

    it('sets deletedAt to the current timestamp if paranoid is true', function() {
      const qi = current.queryInterface.QueryGenerator.quoteIdentifier.bind(current.queryInterface.QueryGenerator);
      const ParanoidUser = current.define<ItestInstance, ItestAttribute>('ParanoidUser', {
        username: new DataTypes.STRING(),
        secretValue: new DataTypes.STRING(),
        data: new DataTypes.STRING(),
        intVal: { type: new DataTypes.INTEGER(), defaultValue: 1}
      }, {
        paranoid: true
      });
      const data = [{ username: 'Peter', secretValue: '42' },
        { username: 'Paul', secretValue: '42' },
        { username: 'Bob', secretValue: '43' }];

      return ParanoidUser.sync({ force: true }).then(() => {
        return ParanoidUser.bulkCreate(data);
      }).bind({}).then(function() {
        // since we save in UTC, let's format to UTC time
        this.date = moment().utc().format('YYYY-MM-DD h:mm');
        return ParanoidUser.destroy({where: {secretValue: '42'}});
      }).then(() => {
        return ParanoidUser.findAll({order: ['id']});
      }).then(users => {
        expect(users.length).to.equal(1);
        expect(users[0].username).to.equal('Bob');

        return current.query('SELECT * FROM ' + qi('ParanoidUsers') + ' WHERE ' + qi('deletedAt') + ' IS NOT NULL ORDER BY ' + qi('id'));
      }).spread(function(users) {
        expect(users[0].username).to.equal('Peter');
        expect(users[1].username).to.equal('Paul');

        if (dialect === 'oracle') {
          //As we have a select * query, we cannot map the name of the fields returned. Oracle returns everything in uppercase, but we change to lowercase
          expect(moment(new Date(users[0].deletedat)).utc().format('YYYY-MM-DD h:mm')).to.equal(this.date);
          expect(moment(new Date(users[1].deletedat)).utc().format('YYYY-MM-DD h:mm')).to.equal(this.date);
        } else {
          expect(moment(new Date(users[0].deletedAt)).utc().format('YYYY-MM-DD h:mm')).to.equal(this.date);
          expect(moment(new Date(users[1].deletedAt)).utc().format('YYYY-MM-DD h:mm')).to.equal(this.date);
        }
      });
    });

    it('does not set deletedAt for previously destroyed instances if paranoid is true', function() {
      User = current.define<ItestInstance, ItestAttribute>('UserCol', {
        secretValue: new DataTypes.STRING(),
        username: new DataTypes.STRING()
      }, { paranoid: true });

      return User.sync({ force: true }).then(() => {
        return User.bulkCreate([
          { username: 'Toni', secretValue: '42' },
          { username: 'Tobi', secretValue: '42' },
          { username: 'Max', secretValue: '42' },
        ]).then(() => {
          return User.findById(1).then(user => {
            return user.destroy().then(() => {
              return user.reload({ paranoid: false }).then(() => {
                const deletedAt = user.deletedAt;

                return User.destroy({ where: { secretValue: '42' } }).then(() => {
                  return user.reload({ paranoid: false }).then(() => {
                    expect(user.deletedAt).to.eql(deletedAt);
                  });
                });
              });
            });
          });
        });
      });
    });

    describe("can't find records marked as deleted with paranoid being true", () => {
      it('with the DAOFactory', function() {
        User = current.define<ItestInstance, ItestAttribute>('UserCol', {
          username: new DataTypes.STRING()
        }, { paranoid: true });

        return User.sync({ force: true }).then(() => {
          return User.bulkCreate([
            {username: 'Toni'},
            {username: 'Tobi'},
            {username: 'Max'},
          ]).then(() => {
            return User.findById(1).then(user => {
              return user.destroy().then(() => {
                return User.findById(1).then(_user => {
                  expect(_user).to.be.null;
                  return User.count().then(cnt => {
                    expect(cnt).to.equal(2);
                    return User.findAll().then(users => {
                      expect(users).to.have.length(2);
                    });
                  });
                });
              });
            });
          });
        });
      });
    });

    describe('can find paranoid records if paranoid is marked as false in query', () => {
      it('with the DAOFactory', function() {
        User = current.define<ItestInstance, ItestAttribute>('UserCol', {
          username: new DataTypes.STRING()
        }, { paranoid: true });

        return User.sync({ force: true })
          .then(() => {
            return User.bulkCreate([
              {username: 'Toni'},
              {username: 'Tobi'},
              {username: 'Max'},
            ]);
          })
          .then(() => User.findById(1))
          .then(user => user.destroy())
          .then(() => User.find({ where: 1, paranoid: false }))
          .then(user => {
            expect(user).to.exist;
            return User.findById(1);
          })
          .then(user => {
            expect(user).to.be.null;
            return [User.count(), User.count({ paranoid: false })];
          })
          .spread((cnt, cntWithDeleted) => {
            expect(cnt).to.equal(2);
            expect(cntWithDeleted).to.equal(3);
          });
      });
    });

    it('should include deleted associated records if include has paranoid marked as false', function() {
      User = current.define<ItestInstance, ItestAttribute>('User', {
        username: new DataTypes.STRING()
      }, { paranoid: true });
      const Pet = current.define<ItestInstance, ItestAttribute>('Pet', {
        name: new DataTypes.STRING(),
        UserId: new DataTypes.INTEGER()
      }, { paranoid: true });

      User.hasMany(Pet);
      Pet.belongsTo(User);

      let user;
      return User.sync({ force: true })
        .then(() => Pet.sync({ force: true }))
        .then(() => User.create({ username: 'Joe' }))
        .then(_user => {
          user = _user;
          return Pet.bulkCreate([
            { name: 'Fido', UserId: user.id },
            { name: 'Fifi', UserId: user.id },
          ]);
        })
        .then(() => Pet.findById(1))
        .then(pet => pet.destroy())
        .then(() => {
          return [
            User.find({ where: {id: user.id}, include: Pet }),
            User.find({
              where: {id: user.id},
              include: [{ model: Pet, paranoid: false }]
            }),
          ];
        })
        .spread((_user, userWithDeletedPets) => {
          expect(_user).to.exist;
          expect((_user as any).Pets).to.have.length(1);
          expect(userWithDeletedPets).to.exist;
          expect((userWithDeletedPets as any).Pets).to.have.length(2);
        });
    });

    it('should delete a paranoid record if I set force to true', function() {
      User = current.define<ItestInstance, ItestAttribute>('paranoiduser', {
        username: new DataTypes.STRING()
      }, { paranoid: true });

      return User.sync({ force: true }).then(() => {
        return User.bulkCreate([
          {username: 'Bob'},
          {username: 'Tobi'},
          {username: 'Max'},
          {username: 'Tony'},
        ]);
      }).then(() => {
        return User.find({where: {username: 'Bob'}});
      }).then(user => {
        return user.destroy({force: true});
      }).then(() => {
        return expect(User.find({where: {username: 'Bob'}})).to.eventually.be.null;
      }).then(() => {
        return User.find({where: {username: 'Tobi'}});
      }).then(tobi => {
        return tobi.destroy();
      }).then(() => {
        return current.query('SELECT * FROM paranoidusers WHERE username=\'Tobi\'', { plain: true});
      }).then(result => {
        expect(result.username).to.equal('Tobi');
        return User.destroy({where: {username: 'Tony'}});
      }).then(() => {
        return current.query('SELECT * FROM paranoidusers WHERE username=\'Tony\'', { plain: true});
      }).then(result => {
        expect(result.username).to.equal('Tony');
        return User.destroy({where: {username: ['Tony', 'Max']}, force: true});
      }).then(() => {
        return current.query('SELECT * FROM paranoidusers', {raw: true});
      }).spread(users => {
        expect(users).to.have.length(1);
        expect(users[0].username).to.equal('Tobi');
      });
    });

    it('returns the number of affected rows', function() {
      const data = [{ username: 'Peter', secretValue: '42' },
          { username: 'Paul', secretValue: '42' },
          { username: 'Bob', secretValue: '43' }];

      return User.bulkCreate(data).then(() => {
        return User.destroy({where: {secretValue: '42'}}).then(affectedRows => {
          expect(affectedRows).to.equal(2);
        });
      }).then(() => {
        return User.destroy({where: {secretValue: '44'}}).then(affectedRows => {
          expect(affectedRows).to.equal(0);
        });
      });
    });

    it('supports table schema/prefix', function() {
      const data = [{ username: 'Peter', secretValue: '42' },
        { username: 'Paul', secretValue: '42' },
        { username: 'Bob', secretValue: '43' }];
      const prefixUser = User.schema('prefix');

      const run = function() {
        return prefixUser.sync({ force: true }).then(() => {
          return prefixUser.bulkCreate(data).then(() => {
            return prefixUser.destroy({where: {secretValue: '42'}}).then(() => {
              return prefixUser.findAll({order: ['id']}).then(users => {
                expect(users.length).to.equal(1);
                expect(users[0].username).to.equal('Bob');
              });
            });
          });
        });
      };

      return current.queryInterface.dropAllSchemas().then(() => {
        return current.queryInterface.createSchema('prefix').then(() => {
          return run.call(this);
        });
      });
    });

    it('should work if model is paranoid and only operator in where clause is a Symbol', function() {
      User = current.define<ItestInstance, ItestAttribute>('User', {
        username: new DataTypes.STRING()
      }, {
        paranoid: true
      });

      return User.sync({ force: true})
        .then(() => User.create({ username: 'foo' }))
        .then(() => User.create({ username: 'bar' }))
        .then(() => {
          return User.destroy({
            where: {
              [Sequelize.Op.or]: [
                { username: 'bar' },
                { username: 'baz' },
              ]
            }
          });
        })
        .then(() => User.findAll())
        .then(users => {
          expect(users).to.have.length(1);
          expect(users[0].get('username')).to.equal('foo');
        });
    });
  });

  describe('restore', () => {
    it('returns an error if the model is not paranoid', function() {
      return User.create({username: 'Peter', secretValue: '42'})
        .then(() => {
          expect(() => {User.restore({where: {secretValue: '42'}}); }).to.throw(Error, 'Model is not paranoid');
        });
    });

    it('restores a previously deleted model', function() {
      const ParanoidUser = current.define<ItestInstance, ItestAttribute>('ParanoidUser', {
        username: new DataTypes.STRING(),
        secretValue: new DataTypes.STRING(),
        data: new DataTypes.STRING(),
        intVal: { type: new DataTypes.INTEGER(), defaultValue: 1}
      }, {
        paranoid: true
      });
      const data = [{ username: 'Peter', secretValue: '42' },
        { username: 'Paul', secretValue: '43' },
        { username: 'Bob', secretValue: '44' }];

      return ParanoidUser.sync({ force: true }).then(() => {
        return ParanoidUser.bulkCreate(data);
      }).then(() => {
        return ParanoidUser.destroy({where: {secretValue: '42'}});
      }).then(() => {
        return ParanoidUser.restore({where: {secretValue: '42'}});
      }).then(() => {
        return ParanoidUser.find({where: {secretValue: '42'}});
      }).then(user => {
        expect(user).to.be.ok;
        expect(user.username).to.equal('Peter');
      });
    });
  });

  describe('equals', () => {
    it('correctly determines equality of objects', function() {
      return User.create({username: 'hallo', data: 'welt'}).then(u => {
        expect(u.equals(u)).to.be.ok;
      });
    });

    // sqlite can't handle multiple primary keys
    if (dialect !== 'sqlite') {
      it('correctly determines equality with multiple primary keys', function() {
        const userKeys = current.define<ItestInstance, ItestAttribute>('userkeys', {
          foo: {type: new DataTypes.STRING(), primaryKey: true},
          bar: {type: new DataTypes.STRING(), primaryKey: true},
          name: new DataTypes.STRING(),
          bio: new DataTypes.TEXT()
        });

        return userKeys.sync({ force: true }).then(() => {
          return userKeys.create({foo: '1', bar: '2', name: 'hallo', bio: 'welt'}).then(u => {
            expect(u.equals(u)).to.be.ok;
          });
        });
      });
    }
  });

  describe('equalsOneOf', () => {
    // sqlite can't handle multiple primary keys
    if (dialect !== 'sqlite') {
      beforeEach(function() {
        userKey = current.define<ItestInstance, ItestAttribute>('userKeys', {
          foo: {type: new DataTypes.STRING(), primaryKey: true},
          bar: {type: new DataTypes.STRING(), primaryKey: true},
          name: new DataTypes.STRING(),
          bio: new DataTypes.TEXT()
        });

        return userKey.sync({ force: true });
      });

      it('determines equality if one is matching', function() {
        return userKey.create({foo: '1', bar: '2', name: 'hallo', bio: 'welt'}).then(u => {
          expect(u.equalsOneOf([u, {a: 1} as any])).to.be.ok;
        });
      });

      it("doesn't determine equality if none is matching", function() {
        return userKey.create({foo: '1', bar: '2', name: 'hallo', bio: 'welt'}).then(u => {
          expect(u.equalsOneOf([{b: 2} as any, {a: 1} as any])).to.not.be.ok;
        });
      });
    }
  });

  describe('count', () => {
    if (current.dialect.supports.transactions) {
      it('supports transactions', function() {
        return Support.prepareTransactionTest(current).bind({}).then(sequelize => {
          User = sequelize.define('User', { username: new DataTypes.STRING() });

          return User.sync({ force: true }).then(() => {
            return sequelize.transaction().then(t => {
              return User.create({ username: 'foo' }, { transaction: t }).then(() => {
                return User.count().then(count1 => {
                  return User.count({ transaction: t }).then(count2 => {
                    expect(count1).to.equal(0);
                    expect(count2).to.equal(1);
                    return t.rollback();
                  });
                });
              });
            });
          });
        });
      });
    }

    it('counts all created objects', function() {
      return User.bulkCreate([{username: 'user1'}, {username: 'user2'}]).then(() => {
        return User.count().then(count => {
          expect(count).to.equal(2);
        });
      });
    });

    it('returns multiple rows when using group', function() {
      return User.bulkCreate([
        {username: 'user1', data: 'A'},
        {username: 'user2', data: 'A'},
        {username: 'user3', data: 'B'},
      ]).then(() => {
        return User.count({
          attributes: ['data'],
          group: ['data']
        }).then(count => {
          expect((count as any).length).to.equal(2);
        });
      });
    });

    describe('options sent to aggregate', () => {
      let options;
      let aggregateSpy;

      beforeEach(function() {
        options = { where: { username: 'user1'}};

        aggregateSpy = sinon.spy(User, 'aggregate');
      });

      afterEach(() => {
        expect(aggregateSpy).to.have.been.calledWith(
          sinon.match.any, sinon.match.any,
          sinon.match.object.and(sinon.match.has('where', { username: 'user1'})));

        aggregateSpy.restore();
      });

      it('modifies option "limit" by setting it to null', function() {
        options.limit = 5;

        return User.count(options).then(() => {
          expect(aggregateSpy).to.have.been.calledWith(
            sinon.match.any, sinon.match.any,
            sinon.match.object.and(sinon.match.has('limit', null)));
        });
      });

      it('modifies option "offset" by setting it to null', function() {
        options.offset = 10;

        return User.count(options).then(() => {
          expect(aggregateSpy).to.have.been.calledWith(
            sinon.match.any, sinon.match.any,
            sinon.match.object.and(sinon.match.has('offset', null)));
        });
      });

      it('modifies option "order" by setting it to null', function() {
        options.order = 'username';

        return User.count(options).then(() => {
          expect(aggregateSpy).to.have.been.calledWith(
            sinon.match.any, sinon.match.any,
            sinon.match.object.and(sinon.match.has('order', null)));
        });
      });
    });

    it('allows sql logging', function() {
      let test = false;
      return User.count({
        logging(sql) {
          test = true;
          expect(sql).to.exist;
          expect(sql.toUpperCase().indexOf('SELECT')).to.be.above(-1);
        }
      }).then(() => {
        expect(test).to.be.true;
      });
    });

    it('filters object', function() {
      return User.create({username: 'user1'}).then(() => {
        return User.create({username: 'foo'}).then(() => {
          return User.count({where: {username: {like: '%us%'}}}).then(count => {
            expect(count).to.equal(1);
          });
        });
      });
    });

    it('supports distinct option', function() {
      const Post = current.define<ItestInstance, ItestAttribute>('Post', {});
      const PostComment = current.define<ItestInstance, ItestAttribute>('PostComment', {});
      Post.hasMany(PostComment);
      return Post.sync({ force: true })
        .then(() => PostComment.sync({ force: true }))
        .then(() => Post.create({}))
        .then(post => PostComment.bulkCreate([{ PostId: post.id }, { PostId: post.id }]))
        .then(() => Promise.join(
          Post.count({ distinct: false, include: [{ model: PostComment, required: false }] }),
          Post.count({ distinct: true, include: [{ model: PostComment, required: false }] }),
          (count1, count2) => {
            expect(count1).to.equal(2);
            expect(count2).to.equal(1);
          })
        );
    });

  });

  describe('min', () => {
    beforeEach(function() {
      UserWithAge = current.define<ItestInstance, ItestAttribute>('UserWithAge', {
        age: new DataTypes.INTEGER()
      });

      UserWithDec = current.define<ItestInstance, ItestAttribute>('UserWithDec', {
        value: new DataTypes.DECIMAL(10, 3)
      });

      return UserWithAge.sync({ force: true }).then(() => {
        return UserWithDec.sync({ force: true });
      });
    });

    if (current.dialect.supports.transactions) {
      it('supports transactions', function() {
        return Support.prepareTransactionTest(current).bind({}).then(sequelize => {
          User = sequelize.define('User', { age: new DataTypes.INTEGER() });

          return User.sync({ force: true }).then(() => {
            return sequelize.transaction().then(t => {
              return User.bulkCreate([{ age: 2 }, { age: 5 }, { age: 3 }], { transaction: t }).then(() => {
                return User.min('age').then(min1 => {
                  return User.min('age', { transaction: t }).then(min2 => {
                    expect(min1).to.be.not.ok;
                    expect(min2).to.equal(2);
                    return t.rollback();
                  });
                });
              });
            });
          });
        });
      });
    }

    it('should return the min value', function() {
      return UserWithAge.bulkCreate([{age: 3}, { age: 2 }]).then(() => {
        return UserWithAge.min('age').then(min => {
          expect(min).to.equal(2);
        });
      });
    });

    it('allows sql logging', function() {
      let test = false;
      return UserWithAge.min('age', {
        logging(sql) {
          test = true;
          expect(sql).to.exist;
          expect(sql.toUpperCase().indexOf('SELECT')).to.be.above(-1);
        }
      }).then(() => {
        expect(test).to.be.true;
      });
    });

    it('should allow decimals in min', function() {
      return UserWithDec.bulkCreate([{value: 5.5}, {value: 3.5}]).then(() => {
        return UserWithDec.min('value').then(min => {
          expect(min).to.equal(3.5);
        });
      });
    });

    it('should allow strings in min', function() {
      return User.bulkCreate([{username: 'bbb'}, {username: 'yyy'}]).then(() => {
        return User.min('username').then(min => {
          expect(min).to.equal('bbb');
        });
      });
    });

    it('should allow dates in min', function() {
      return User.bulkCreate([{theDate: new Date(2000, 1, 1)}, {theDate: new Date(1990, 1, 1)}]).then(() => {
        return User.min('theDate').then(min => {
          expect(min).to.be.a('Date');
          expect(new Date(1990, 1, 1)).to.equalDate(min);
        });
      });
    });
  });

  describe('max', () => {
    beforeEach(function() {
      UserWithAge = current.define<ItestInstance, ItestAttribute>('UserWithAge', {
        age: new DataTypes.INTEGER(),
        order: new DataTypes.INTEGER()
      });

      UserWithDec = current.define<ItestInstance, ItestAttribute>('UserWithDec', {
        value: new DataTypes.DECIMAL(10, 3)
      });

      return UserWithAge.sync({ force: true }).then(() => {
        return UserWithDec.sync({ force: true });
      });
    });

    if (current.dialect.supports.transactions) {
      it('supports transactions', function() {
        return Support.prepareTransactionTest(current).bind({}).then(sequelize => {
          User = sequelize.define('User', { age: new DataTypes.INTEGER() });

          return User.sync({ force: true }).then(() => {
            return sequelize.transaction().then(t => {
              return User.bulkCreate([{ age: 2 }, { age: 5 }, { age: 3 }], { transaction: t }).then(() => {
                return User.max('age').then(min1 => {
                  return User.max('age', { transaction: t }).then(min2 => {
                    expect(min1).to.be.not.ok;
                    expect(min2).to.equal(5);
                    return t.rollback();
                  });
                });
              });
            });
          });
        });
      });
    }

    it('should return the max value for a field named the same as an SQL reserved keyword', function() {
      return UserWithAge.bulkCreate([{age: 2, order: 3}, {age: 3, order: 5}]).then(() => {
        return UserWithAge.max('order').then(max => {
          expect(max).to.equal(5);
        });
      });
    });

    it('should return the max value', function() {
      return UserWithAge.bulkCreate([{age: 2}, {age: 3}]).then(() => {
        return UserWithAge.max('age').then(max => {
          expect(max).to.equal(3);
        });
      });
    });

    it('should allow decimals in max', function() {
      return UserWithDec.bulkCreate([{value: 3.5}, {value: 5.5}]).then(() => {
        return UserWithDec.max('value').then(max => {
          expect(max).to.equal(5.5);
        });
      });
    });

    it('should allow dates in max', function() {
      return User.bulkCreate([
        {theDate: new Date(2013, 11, 31)},
        {theDate: new Date(2000, 1, 1)},
      ]).then(() => {
        return User.max('theDate').then(max => {
          expect(max).to.be.a('Date');
          expect(max).to.equalDate(new Date(2013, 11, 31));
        });
      });
    });

    it('should allow strings in max', function() {
      return User.bulkCreate([{username: 'aaa'}, {username: 'zzz'}]).then(() => {
        return User.max('username').then(max => {
          expect(max).to.equal('zzz');
        });
      });
    });

    it('allows sql logging', function() {
      let logged = false;
      return UserWithAge.max('age', {
        logging(sql) {
          expect(sql).to.exist;
          logged = true;
          expect(sql.toUpperCase().indexOf('SELECT')).to.be.above(-1);
        }
      }).then(() => {
        expect(logged).to.true;
      });
    });
  });

  describe('sum', () => {
    beforeEach(function() {
      UserWithAge = current.define<ItestInstance, ItestAttribute>('UserWithAge', {
        age: new DataTypes.INTEGER(),
        order: new DataTypes.INTEGER(),
        gender: new DataTypes.ENUM('male', 'female')
      });

      UserWithDec = current.define<ItestInstance, ItestAttribute>('UserWithDec', {
        value: new DataTypes.DECIMAL(10, 3)
      });

      UserWithFields = current.define<ItestInstance, ItestAttribute>('UserWithFields', {
        age: {
          type: new DataTypes.INTEGER(),
          field: 'user_age'
        },
        order: new DataTypes.INTEGER(),
        gender: {
          type: new DataTypes.ENUM('male', 'female'),
          field: 'male_female'
        }
      });

      return Promise.join(
        UserWithAge.sync({ force: true }),
        UserWithDec.sync({ force: true }),
        UserWithFields.sync({ force: true })
      );
    });

    it('should return the sum of the values for a field named the same as an SQL reserved keyword', function() {
      return UserWithAge.bulkCreate([{age: 2, order: 3}, {age: 3, order: 5}]).then(() => {
        return UserWithAge.sum('order').then(sum => {
          expect(sum).to.equal(8);
        });
      });
    });

    it('should return the sum of a field in various records', function() {
      return UserWithAge.bulkCreate([{age: 2}, {age: 3}]).then(() => {
        return UserWithAge.sum('age').then(sum => {
          expect(sum).to.equal(5);
        });
      });
    });

    it('should allow decimals in sum', function() {
      return UserWithDec.bulkCreate([{value: 3.5}, {value: 5.25}]).then(() => {
        return UserWithDec.sum('value').then(sum => {
          expect(sum).to.equal(8.75);
        });
      });
    });

    it('should accept a where clause', function() {
      const options = { where: { gender: 'male' }};

      return UserWithAge.bulkCreate([{age: 2, gender: 'male'}, {age: 3, gender: 'female'}]).then(() => {
        return UserWithAge.sum('age', options).then(sum => {
          expect(sum).to.equal(2);
        });
      });
    });

    it('should accept a where clause with custom fields', function() {
      return UserWithFields.bulkCreate([
        {age: 2, gender: 'male'},
        {age: 3, gender: 'female'},
      ]).bind(this).then(function() {
        return expect(UserWithFields.sum('age', {
          where: { gender: 'male' }
        })).to.eventually.equal(2);
      });
    });

    it('allows sql logging', function() {
      let logged = false;
      return UserWithAge.sum('age', {
        logging(sql) {
          expect(sql).to.exist;
          logged = true;
          expect(sql.toUpperCase().indexOf('SELECT')).to.be.above(-1);
        }
      }).then(() => {
        expect(logged).to.true;
      });
    });
  });

  describe('schematic support', () => {
    beforeEach(function() {
      UserPublic = current.define<ItestInstance, ItestAttribute>('UserPublic', {
        age: new DataTypes.INTEGER()
      });

      UserSpecial = current.define<ItestInstance, ItestAttribute>('UserSpecial', {
        age: new DataTypes.INTEGER()
      });

      return current.dropAllSchemas().then(() => {
        return current.createSchema('schema_test').then(() => {
          return current.createSchema('special').then(() => {
            return UserSpecial.schema('special').sync({force: true}).then(_UserSpecialSync => {
              UserSpecialSync = _UserSpecialSync;
            });
          });
        });
      });
    });

    it('should be able to drop with schemas', function() {
      return UserSpecial.drop();
    });

    it('should be able to list schemas', function() {
      return current.showAllSchemas().then(schemas => {
        expect(schemas).to.be.instanceof(Array);

        // FIXME: reenable when schema support is properly added
        if (dialect !== 'mssql') {
          // sqlite & MySQL doesn't actually create schemas unless Model.sync() is called
          // Postgres supports schemas natively
          expect(schemas).to.have.length((dialect === 'postgres' || dialect === 'oracle' ? 2 : 1));
        }

      });
    });

    if (dialect === 'mysql' || dialect === 'sqlite') {
      it('should take schemaDelimiter into account if applicable', function() {
        let test = 0;
        const UserSpecialUnderscore = current.define<ItestInstance, ItestAttribute>('UserSpecialUnderscore', {age: new DataTypes.INTEGER()}, {schema: 'hello', schemaDelimiter: '_'});
        const UserSpecialDblUnderscore = current.define<ItestInstance, ItestAttribute>('UserSpecialDblUnderscore', {age: new DataTypes.INTEGER()});
        return UserSpecialUnderscore.sync({force: true}).then(_User => {
          return UserSpecialDblUnderscore.schema('hello', '__').sync({force: true}).then(DblUser => {
            return DblUser.create({age: 3}, {
              logging(sql) {
                expect(sql).to.exist;
                test++;
                expect(sql.indexOf('INSERT INTO `hello__UserSpecialDblUnderscores`')).to.be.above(-1);
              }
            }).then(() => {
              return _User.create({age: 3}, {
                logging(sql) {
                  expect(sql).to.exist;
                  test++;
                  expect(sql.indexOf('INSERT INTO `hello_UserSpecialUnderscores`')).to.be.above(-1);
                }
              });
            });
          }).then(() => {
            expect(test).to.equal(2);
          });
        });
      });
    }

    it('should describeTable using the default schema settings', function() {
      const _UserPublic = current.define<ItestInstance, ItestAttribute>('Public', {
        username: new DataTypes.STRING()
      });
      let count = 0;

      return _UserPublic.sync({ force: true }).then(() => {
        return _UserPublic.schema('special').sync({ force: true }).then(() => {
          return current.queryInterface.describeTable('Publics', {
            logging: sql => {
              if (dialect === 'sqlite' || dialect === 'mysql' || dialect === 'mssql' || dialect === 'oracle') {
                expect(sql).to.not.contain('special');
                count++;
              }
            }
          }).then(table => {
            if (dialect === 'postgres') {
              expect(table.id.defaultValue).to.not.contain('special');
              count++;
            }
            return current.queryInterface.describeTable('Publics', {
              schema: 'special',
              logging: sql => {
                if (dialect === 'sqlite' || dialect === 'mysql' || dialect === 'mssql' || dialect === 'oracle') {
                  expect(sql).to.contain('special');
                  count++;
                }
              }
            }).then(_table => {
              if (dialect === 'postgres') {
                expect(_table.id.defaultValue).to.contain('special');
                count++;
              }
            });
          }).then(() => {
            expect(count).to.equal(2);
          });
        });
      });
    });

    it('should be able to reference a table with a schema set', function() {
      const UserPub = current.define<ItestInstance, ItestAttribute>('UserPub', {
        username: new DataTypes.STRING()
      }, { schema: 'prefix' });

      const ItemPub = current.define<ItestInstance, ItestAttribute>('ItemPub', {
        name: new DataTypes.STRING()
      }, { schema: 'prefix' });

      UserPub.hasMany(ItemPub, {
        foreignKeyConstraint: true
      });

      const run = function() {
        return UserPub.sync({ force: true }).then(() => {
          return ItemPub.sync({ force: true, logging: _.after(2, _.once(sql => {
            if (dialect === 'postgres') {
              expect(sql).to.match(/REFERENCES\s+"prefix"\."UserPubs" \("id"\)/);
            } else if (dialect === 'mssql') {
              expect(sql).to.match(/REFERENCES\s+\[prefix\]\.\[UserPubs\] \(\[id\]\)/);
            }  else if (dialect === 'oracle') {
              expect(sql).to.match(/REFERENCES\s+prefix\.UserPubs \(id\)/);
            } else {
              expect(sql).to.match(/REFERENCES\s+`prefix\.UserPubs` \(`id`\)/);
            }

          }))});
        });
      };

      if (dialect === 'postgres' || dialect === 'oracle' || dialect === 'mssql') {
        return current.queryInterface.dropAllSchemas().then(() => {
          return current.queryInterface.createSchema('prefix').then(() => {
            return run.call(this);
          });
        });
      } else {
        return run.call(this);
      }
    });

    it('should be able to create and update records under any valid schematic', function() {
      let logged = 0;
      return UserPublic.sync({ force: true }).then(UserPublicSync => {
        return UserPublicSync.create({age: 3}, {
          logging(_UserPublic) {
            logged++;
            if (dialect === 'postgres') {
              expect(UserSpecialSync.getTableName().toString()).to.equal('"special"."UserSpecials"');
              expect(_UserPublic.indexOf('INSERT INTO "UserPublics"')).to.be.above(-1);
            } else if (dialect === 'sqlite') {
              expect(UserSpecialSync.getTableName().toString()).to.equal('`special.UserSpecials`');
              expect(_UserPublic.indexOf('INSERT INTO `UserPublics`')).to.be.above(-1);
            } else if (dialect === 'mssql') {
              expect(UserSpecialSync.getTableName().toString()).to.equal('[special].[UserSpecials]');
              expect(_UserPublic.indexOf('INSERT INTO [UserPublics]')).to.be.above(-1);
            } else if (dialect === 'oracle') {
              expect(UserSpecialSync.getTableName().toString()).to.equal('special.UserSpecials');
              expect(_UserPublic.indexOf('INSERT INTO UserPublics')).to.be.above(-1);
            } else {
              expect(UserSpecialSync.getTableName().toString()).to.equal('`special.UserSpecials`');
              expect(_UserPublic.indexOf('INSERT INTO `UserPublics`')).to.be.above(-1);
            }
          }
        }).then(() => {
          return UserSpecialSync.schema('special').create({age: 3}, {
            logging(_UserSpecial) {
              logged++;
              if (dialect === 'postgres') {
                expect(_UserSpecial.indexOf('INSERT INTO "special"."UserSpecials"')).to.be.above(-1);
              } else if (dialect === 'sqlite') {
                expect(_UserSpecial.indexOf('INSERT INTO `special.UserSpecials`')).to.be.above(-1);
              } else if (dialect === 'mssql') {
                expect(_UserSpecial.indexOf('INSERT INTO [special].[UserSpecials]')).to.be.above(-1);
              } else if (dialect === 'oracle') {
                expect(_UserSpecial.indexOf('INSERT INTO special.UserSpecials')).to.be.above(-1);
              } else {
                expect(_UserSpecial.indexOf('INSERT INTO `special.UserSpecials`')).to.be.above(-1);
              }
            }
          }).then(_UserSpecial => {
            return _UserSpecial.updateAttributes({age: 5}, {
              logging(user) {
                logged++;
                if (dialect === 'postgres') {
                  expect(user.indexOf('UPDATE "special"."UserSpecials"')).to.be.above(-1);
                } else if (dialect === 'mssql') {
                  expect(user.indexOf('UPDATE [special].[UserSpecials]')).to.be.above(-1);
                } else if (dialect === 'oracle') {
                  expect(user.indexOf('UPDATE special.UserSpecials')).to.be.above(-1);
                } else {
                  expect(user.indexOf('UPDATE `special.UserSpecials`')).to.be.above(-1);
                }
              }
            });
          });
        }).then(() => {
          expect(logged).to.equal(3);
        });
      });
    });
  });

  describe('references', () => {
    beforeEach(function() {
      Author = current.define<ItestInstance, ItestAttribute>('author', { firstName: new DataTypes.STRING() });

      return current.getQueryInterface().dropTable('posts', { force: true }).then(() => {
        return current.getQueryInterface().dropTable('authors', { force: true });
      }).then(() => {
        return Author.sync();
      });
    });

    it('uses an existing dao factory and references the author table', function() {
      const authorIdColumn = { type: new DataTypes.INTEGER(), references: { model: Author, key: 'id' } };

      const Post = current.define<ItestInstance, ItestAttribute>('post', {
        title: new DataTypes.STRING(),
        authorId: authorIdColumn
      });

      Author.hasMany(Post);
      Post.belongsTo(Author);

      // The posts table gets dropped in the before filter.
      return Post.sync({logging: _.once(sql => {
        if (dialect === 'postgres') {
          expect(sql).to.match(/"authorId" INTEGER REFERENCES "authors" \("id"\)/);
        } else if (dialect === 'mysql') {
          expect(sql).to.match(/FOREIGN KEY \(`authorId`\) REFERENCES `authors` \(`id`\)/);
        } else if (dialect === 'mssql') {
          expect(sql).to.match(/FOREIGN KEY \(\[authorId\]\) REFERENCES \[authors\] \(\[id\]\)/);
        } else if (dialect === 'sqlite') {
          expect(sql).to.match(/`authorId` INTEGER REFERENCES `authors` \(`id`\)/);
        } else if (dialect === 'oracle') {
          expect(sql).to.match(/FOREIGN KEY \(authorId\) REFERENCES authors \(id\)/);
        } else {
          throw new Error('Undefined dialect!');
        }
      })});
    });

    it('uses a table name as a string and references the author table', function() {
      const authorIdColumn = { type: new DataTypes.INTEGER(), references: { model: 'authors', key: 'id' } };

      const Post = current.define('post', { title: new DataTypes.STRING(), authorId: authorIdColumn });

      Author.hasMany(Post);
      Post.belongsTo(Author);

      // The posts table gets dropped in the before filter.
      return Post.sync({logging: _.once(sql => {
        if (dialect === 'postgres') {
          expect(sql).to.match(/"authorId" INTEGER REFERENCES "authors" \("id"\)/);
        } else if (dialect === 'mysql') {
          expect(sql).to.match(/FOREIGN KEY \(`authorId`\) REFERENCES `authors` \(`id`\)/);
        } else if (dialect === 'sqlite') {
          expect(sql).to.match(/`authorId` INTEGER REFERENCES `authors` \(`id`\)/);
        } else if (dialect === 'mssql') {
          expect(sql).to.match(/FOREIGN KEY \(\[authorId\]\) REFERENCES \[authors\] \(\[id\]\)/);
        } else if (dialect === 'oracle') {
          expect(sql).to.match(/FOREIGN KEY \(authorId\) REFERENCES authors \(id\)/);
        } else {
          throw new Error('Undefined dialect!');
        }
      })});
    });

    it('emits an error event as the referenced table name is invalid', function() {
      const authorIdColumn = { type: new DataTypes.INTEGER(), references: { model: '4uth0r5', key: 'id' } };

      const Post = current.define<ItestInstance, ItestAttribute>('post', { title: new DataTypes.STRING(), authorId: authorIdColumn });

      Author.hasMany(Post);
      Post.belongsTo(Author);

      // The posts table gets dropped in the before filter.
      return Post.sync().then(() => {
        if (dialect === 'sqlite') {
          // sorry ... but sqlite is too stupid to understand whats going on ...
          expect(1).to.equal(1);
        } else {
          // the parser should not end up here ...
          expect(2).to.equal(1);
        }

        return;
      }).catch (err => {
        if (dialect === 'mysql') {
          // MySQL 5.7 or above doesn't support POINT EMPTY
          if (dialect === 'mysql' && semver.gte(current.options.databaseVersion, '5.6.0')) {
            expect(err.message).to.match(/Cannot add foreign key constraint/);
          } else {
            expect(err.message).to.match(/Can\'t create table/);
          }
        } else if (dialect === 'sqlite') {
          // the parser should not end up here ... see above
          expect(1).to.equal(2);
        } else if (dialect === 'postgres') {
          expect(err.message).to.match(/relation "4uth0r5" does not exist/);
        } else if (dialect === 'mssql') {
          expect(err.message).to.match(/references invalid table/);
        } else if (dialect === 'oracle') {
          expect(err.message).to.match(/ORA-00903: invalid table name/);
        } else {
          throw new Error('Undefined dialect!');
        }
      });
    });

    it('works with comments', function() {
      // Test for a case where the comment was being moved to the end of the table when there was also a reference on the column, see #1521
      const Member = current.define<ItestInstance, ItestAttribute>('Member', {});
      const idColumn : any = {
        type: new DataTypes.INTEGER(),
        primaryKey: true,
        autoIncrement: false,
        comment: 'asdf'
      };

      idColumn.references = { model: Member, key: 'id' };

      current.define<ItestInstance, ItestAttribute>('Profile', { id: idColumn });

      return current.sync({ force: true });
    });
  });

  describe('blob', () => {
    beforeEach(function() {
      BlobUser = current.define<ItestInstance, ItestAttribute>('blobUser', {
        data: new DataTypes.BLOB()
      });

      return BlobUser.sync({ force: true });
    });

    describe('buffers', () => {
      it('should be able to take a buffer as parameter to a BLOB field', function() {
        return BlobUser.create({
          data: new Buffer('Sequelize')
        }).then(user => {
          expect(user).to.be.ok;
        });
      });

      it('should return a buffer when fetching a blob', function() {
        return BlobUser.create({
          data: new Buffer('Sequelize')
        }).then(user => {
          return BlobUser.findById(user.id).then(_user => {
            if (dialect !== 'oracle') {
              expect(_user.data).to.be.an.instanceOf(Buffer);
              expect(_user.data.toString()).to.have.string('Sequelize');
            } else {
              //oracle returns a iLob Object, we have to read it
              _user.data.iLob.read((err, lobData) => {
                expect(lobData).to.be.an.instanceOf(Buffer);
                expect(lobData.toString()).to.have.string('Sequelize');
              });
            }
          });
        });
      });

      it('should work when the database returns null', function() {
        return BlobUser.create({
          // create a null column
        }).then(user => {
          return BlobUser.findById(user.id).then(_user => {
            expect(_user.data).to.be.null;
          });
        });
      });
    });

    if (dialect !== 'mssql') {
      // NOTE: someone remember to inform me about the intent of these tests. Are
      //       you saying that data passed in as a string is automatically converted
      //       to binary? i.e. "Sequelize" is CAST as binary, OR that actual binary
      //       data is passed in, in string form? Very unclear, and very different.

      describe('strings', () => {
        it('should be able to take a string as parameter to a BLOB field', function() {
          return BlobUser.create({
            data: 'Sequelize'
          }).then(user => {
            expect(user).to.be.ok;
          });
        });

        it('should return a buffer when fetching a BLOB, even when the BLOB was inserted as a string', function() {
          return BlobUser.create({
            data: 'Sequelize'
          }).then(user => {
            return BlobUser.findById(user.id).then(_user => {
              if (dialect !== 'oracle') {
                expect(_user.data).to.be.an.instanceOf(Buffer);
                expect(_user.data.toString()).to.have.string('Sequelize');
              } else {
                //oracle returns a iLob Object, we have to read it
                _user.data.iLob.read((err, lobData) => {
                  expect(lobData).to.be.an.instanceOf(Buffer);
                  expect(lobData.toString()).to.have.string('Sequelize');
                });
              }
            });
          });
        });
      });
    }

  });

  describe('paranoid is true and where is an array', () => {

    beforeEach(function() {
      User = current.define<ItestInstance, ItestAttribute>('User', {username: new DataTypes.STRING() }, { paranoid: true });
      Project = current.define<ItestInstance, ItestAttribute>('Project', { title: new DataTypes.STRING() }, { paranoid: true });

      Project.belongsToMany(User, {through: 'project_user'});
      User.belongsToMany(Project, {through: 'project_user'});

      return current.sync({ force: true }).then(() => {
        return User.bulkCreate([{
          username: 'leia'
        }, {
          username: 'luke'
        }, {
          username: 'vader'
        }]).then(() => {
          return Project.bulkCreate([{
            title: 'republic'
          }, {
            title: 'empire'
          }]).then(() => {
            return User.findAll().then(users => {
              return Project.findAll().then(projects => {
                const leia = users[0];
                const luke = users[1];
                const vader = users[2];
                const republic = projects[0];
                const empire = projects[1];
                return leia.setLinkedData('Project', [republic]).then(() => {
                  return luke.setLinkedData('Project', [republic]).then(() => {
                    return vader.setLinkedData('Project', [empire]).then(() => {
                      return leia.destroy();
                    });
                  });
                });
              });
            });
          });
        });
      });
    });

    it('should not fail when array contains Sequelize.or / and', function() {
      return User.findAll({
        where: [
          current.or({ username: 'vader' }, { username: 'luke' }),
          current.and({ id: [1, 2, 3] }),
        ]
      })
        .then(res => {
          expect(res).to.have.length(2);
        });
    });

    it('should fail when array contains strings', function() {
      return expect(User.findAll({
        where: ['this is a mistake', ['dont do it!']]
      })).to.eventually.be.rejectedWith(Error, 'Support for literal replacements in the `where` object has been removed.');
    });

    it('should not fail with an include', function() {
      return User.findAll({
        where: current.literal(current.queryInterface.QueryGenerator.quoteIdentifiers('Projects.title') + ' = ' + current.queryInterface.QueryGenerator.escape('republic')),
        include: [
          {model: Project},
        ]
      }).then(users => {
        expect(users.length).to.be.equal(1);
        expect(users[0].username).to.be.equal('luke');
      });
    });

    it('should not overwrite a specified deletedAt by setting paranoid: false', function() {
      let tableName = '';
      if (User.name) {
        tableName = current.queryInterface.QueryGenerator.quoteIdentifier(User.name) + '.';
      }
      return User.findAll({
        paranoid: false,
        where: current.literal(tableName + current.queryInterface.QueryGenerator.quoteIdentifier('deletedAt') + ' IS NOT NULL '),
        include: [
          {model: Project},
        ]
      }).then(users => {
        expect(users.length).to.be.equal(1);
        expect(users[0].username).to.be.equal('leia');
      });
    });

    //As paranoid:true / false is not read for the destroy, the test is false
    it.skip('should not overwrite a specified deletedAt (complex query) by setting paranoid: false', function() {
      return User.findAll({
        paranoid: false,
        where: [
          current.or({ username: 'leia' }, { username: 'luke' }),
          current.and(
            { id: [1, 2, 3] },
            current.or({ deletedAt: null }, { deletedAt: { gt: new Date(0) } })
          ),
        ]
      })
        .then(res => {
          expect(res).to.have.length(2);
        });
    });

  });

  //For some reason, oracle pass this test but this makes all other fail -> docker is too light
  if (dialect !== 'sqlite' && dialect !== 'oracle' && current.dialect.supports.transactions) {
    it('supports multiple async transactions', function() {
      this.timeout(90000);
      return Support.prepareTransactionTest(current).bind({}).then(sequelize => {
        User = sequelize.define('User', { username: new DataTypes.STRING() });
        const testAsync = () => {
          return sequelize.transaction().then(t => {
            return User.create({
              username: 'foo'
            }, {
              transaction: t
            }).then(() => {
              return User.findAll({
                where: {
                  username: 'foo'
                },
              }).then(users => {
                expect(users).to.have.length(0);
                return User.findAll({
                  where: {
                    username: 'foo'
                  },
                  transaction: t
                }).then(users2 => {
                  expect(users2).to.have.length(1);
                  return t.rollback();
                });
              });
            });
          });
        };
        return User.sync({ force: true }).then(function() {
          const tasks = [];
          for (let i = 0; i < 1000; i++) {
            tasks.push(testAsync.bind(this));
          }
          return current.Promise.resolve(tasks).map(entry => {
            return entry();
          }, {
            // Needs to be one less than ??? else the non transaction query won't ever get a connection
            concurrency: (sequelize.config.pool && sequelize.config.pool.max || 5) - 1
          })
          .catch(err => {
            throw err;
          });
        });
      });
    });
  }

  describe('Unique', () => {
    it('should set unique when unique is true', function() {
      const uniqueTrue = current.define('uniqueTrue', {
        str: { type: new DataTypes.STRING(), unique: true }
      });

      return uniqueTrue.sync({force: true, logging: _.after(2, _.once(s => {
        expect(s).to.match(/UNIQUE/);
      }))});
    });

    it('should not set unique when unique is false', function() {
      const uniqueFalse = current.define('uniqueFalse', {
        str: { type: new DataTypes.STRING(), unique: false }
      });

      return uniqueFalse.sync({force: true, logging: _.after(2, _.once(s => {
        expect(s).not.to.match(/UNIQUE/);
      }))});
    });

    it('should not set unique when unique is unset', function() {
      const uniqueUnset = current.define('uniqueUnset', {
        str: { type: new DataTypes.STRING() }
      });

      return uniqueUnset.sync({force: true, logging: _.after(2, _.once(s => {
        expect(s).not.to.match(/UNIQUE/);
      }))});
    });
  });

  it('should be possible to use a key named UUID as foreign key', function() {
    current.define<ItestInstance, ItestAttribute>('project', {
      UserId: {
        type: new DataTypes.STRING(),
        references: {
          model: 'Users',
          key: 'UUID'
        }
      }
    });

    current.define<ItestInstance, ItestAttribute>('Users', {
      UUID: {
        type: new DataTypes.STRING(),
        primaryKey: true,
        unique: true,
        allowNull: false,
        validate: {
          notNull: true,
          notEmpty: true
        }
      }
    });

    return current.sync({force: true});
  });

  describe('bulkCreate errors', () => {
    it('should return array of errors if validate and individualHooks are true', function() {
      const data = [{ username: null },
        { username: null },
        { username: null }];

      const user = current.define<ItestInstance, ItestAttribute>('Users', {
        username: {
          type: new DataTypes.STRING(),
          allowNull: false,
          validate: {
            notNull: true,
            notEmpty: true
          }
        }
      });

      return expect(user.bulkCreate(data, {
        validate: true,
        individualHooks: true
      })).to.be.rejectedWith(Promise.AggregateError);
    });
  });
});

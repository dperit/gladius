document.addEventListener( "DOMContentLoaded", function( e ) {

  require.config({
    baseUrl: "../.."
  });

  require(
    [ "gladius-core",
      "gladius-cubicvr",
      "gladius-input",
      "gladius-box2d" ],
    function( Gladius, cubicvrExtension, inputExtension, box2dExtension ) {

      var engine = new Gladius();

      // Engine monitor setup
      function monitor( engine ) {
        debugger;
        engine.detach( monitor );
      }
      document.addEventListener( "keydown", function( event ) {
        var code = event.which || event.keyCode;
        if( code === 0x4D && event.ctrlKey && event.altKey ) {
          engine.attach( monitor );
        }
      });

      var cubicvrOptions = {
        renderer: {
          canvas: document.getElementById( "test-canvas" )
        }
      };
      engine.registerExtension( cubicvrExtension, cubicvrOptions );
      var inputOptions = {
        dispatcher: {
          element: document
        }
      }
      engine.registerExtension( inputExtension, inputOptions );
      //Need to find a way to make this property access longer :)
      engine.registerExtension( box2dExtension, {resolver: {dimensionMap: box2dExtension.services.resolver.service.prototype.DimensionMaps.XZ}});

      var cubicvr = engine.findExtension( "gladius-cubicvr" );
      var input = engine.findExtension( "gladius-input" );
      var box2d = engine.findExtension( "gladius-box2d" );
      var resources = {};

      var bulletMaterialArgs = '?colorTexture=../assets/images/cube-diffuse.jpg' +
        '&bumpTexture=../assets/images/cube-bump.jpg' +
        '&normalTexture=../assets/images/cube-normal.jpg';

      var materialArgs = '?colorTexture=../assets/images/tank-diffuse.jpg' +
        '&bumpTexture=../assets/images/tank-bump.jpg' +
        '&normalTexture=../assets/images/tank-normal.jpg';

      var redMaterialArgs = '?colorTexture=../assets/images/red-tank-diffuse.jpg' +
        '&bumpTexture=../assets/images/tank-bump.jpg' +
        '&normalTexture=../assets/images/tank-normal.jpg';

      var wallMaterialArgs = '?colorTexture=../assets/images/cube-impulse-diffuse.jpg' +
        '&bumpTexture=../assets/images/cube-impulse-bump.jpg' +
        '&normalTexture=../assets/images/cube-impulse-normal.jpg';

      engine.get(
        [
          {
            type: cubicvr.Mesh,
            url: "../assets/procedural-prism.js?length=2.0&width=1.0&depth=0.5",
            load: engine.loaders.procedural,
            onsuccess: function( mesh ) {
              resources.tankBody = mesh;
            },
            onfailure: function( error ) {
            }
          },
          {
            type: cubicvr.Mesh,
            url: "../assets/procedural-prism.js?length=1.7&width=0.4&depth=0.7",
            load: engine.loaders.procedural,
            onsuccess: function( mesh ) {
              resources.tankTread = mesh;
            },
            onfailure: function( error ) {
            }
          },
          {
            type: cubicvr.Mesh,
            url: "../assets/procedural-prism.js?length=1.0&width=0.7&depth=0.3",
            load: engine.loaders.procedural,
            onsuccess: function( mesh ) {
              resources.tankTurret = mesh;
            },
            onfailure: function( error ) {
            }
          },
          {
            type: cubicvr.Mesh,
            url: "../assets/procedural-prism.js?length=0.8&width=0.2&depth=0.1",
            load: engine.loaders.procedural,
            onsuccess: function( mesh ) {
              resources.tankBarrel = mesh;
            },
            onfailure: function( error ) {
            }
          },
          {
            type: cubicvr.Mesh,
            url: "../assets/procedural-prism.js?length=10&width=1&depth=1",
            load: engine.loaders.procedural,
            onsuccess: function( mesh ) {
              resources.wall = mesh;
            },
            onfailure: function( error ) {
            }
          },
          {
            type: cubicvr.Mesh,
            url: "../assets/procedural-sphere.js?type=sphere&radius=0.25",
            load: engine.loaders.procedural,
            onsuccess: function( mesh ) {
              resources.bullet = mesh;
            },
            onfailure: function( error ) {
            }
          },
          {
            type: cubicvr.MaterialDefinition,
            url: "../assets/procedural-material.js" + materialArgs,
            load: engine.loaders.procedural,
            onsuccess: function( material ) {
              resources.material = material;
            },
            onfailure: function( error ) {
            }
          },
          {
            type: cubicvr.MaterialDefinition,
            url: "../assets/procedural-material.js" + redMaterialArgs,
            load: engine.loaders.procedural,
            onsuccess: function( material ) {
              resources.redMaterial = material;
            },
            onfailure: function( error ) {
            }
          },
          {
            type: cubicvr.MaterialDefinition,
            url: "../assets/procedural-material.js" + wallMaterialArgs,
            load: engine.loaders.procedural,
            onsuccess: function( material ) {
              resources.wallMaterial = material;
            },
            onfailure: function( error ) {
            }
          },
          {
            type: cubicvr.MaterialDefinition,
            url: "../assets/procedural-material.js" + bulletMaterialArgs,
            load: engine.loaders.procedural,
            onsuccess: function( material ) {
              resources.bulletMaterial = material;
            },
            onfailure: function( error ) {
            }
          },
          {
            type: input.Map,
            url: "tank-controls.json",
            onsuccess: function( inputMap ) {
              resources.tankControls = inputMap;
            },
            onfailure: function( error ) {
            }
          }
        ],
        {
          oncomplete: game.bind( null, engine, resources )
        }
      );

    });

  function game( engine, resources ) {
    var math = engine.math;
    var space = new engine.SimulationSpace();
    var cubicvr = engine.findExtension( "gladius-cubicvr" );
    var input = engine.findExtension( "gladius-input" );
    var box2d = engine.findExtension( "gladius-box2d" );
    var Entity = engine.Entity;

    var lastBulletTime = 0;
    var tankFiringInterval = 500;
    var tankMovementSpeed = 0.003;
    var tankRotationSpeed = 0.002;
    var turretRotationSpeed = 0.002;

    var lightDefinition = new cubicvr.LightDefinition({
      intensity: 1.5,
      distance: 30,
      light_type: cubicvr.LightDefinition.LightTypes.POINT,
      method: cubicvr.LightDefinition.LightingMethods.DYNAMIC
    });

    var tankLogic = {
      "Update": function( event ) {
        if( this.owner.hasComponent( "Controller" ) ) {
          var controller = this.owner.findComponent( "Controller" );
          var transform = space.findNamed( "tank-body" ).findComponent( "Transform" );
          var turretTransform = space.findNamed ("tank-turret").findComponent( "Transform" );
          if( controller.states["MoveForward"] ) {
            transform.position.add( transform.directionToLocal( [space.clock.delta * tankMovementSpeed, 0, 0] ) );
          }
          if( controller.states["MoveBackward"] ) {
            transform.position.add( transform.directionToLocal( [space.clock.delta * -tankMovementSpeed, 0, 0] ));
          }
          if( controller.states["TurnLeft"] ) {
            if( controller.states["StrafeModifier"] ) {
              transform.position.add( transform.directionToLocal( [0, space.clock.delta * -tankMovementSpeed, 0] ));
            } else {
              transform.rotation.add([0, 0, space.clock.delta * -tankRotationSpeed] );
            }
          }
          if( controller.states["TurnRight"] ) {
            if( controller.states["StrafeModifier"] ) {
              transform.position.add( transform.directionToLocal( [0, space.clock.delta * tankMovementSpeed, 0] ));
            } else {
              transform.rotation.add([0, 0, space.clock.delta * tankRotationSpeed] );
            }
          }
          if (controller.states["TurnTurretLeft"] ) {
            turretTransform.rotation.add([0, 0, space.clock.delta * -turretRotationSpeed]);
          }
          if (controller.states["TurnTurretRight"] ) {
            turretTransform.rotation.add([0, 0, space.clock.delta * turretRotationSpeed]);
          }
        }
      },
      "Fire": function( event ) {
        if (space.clock.time - tankFiringInterval > lastBulletTime){
          lastBulletTime = space.clock.time;
          var physicsBody = new box2d.Body({bodyDefinition: new box2d.BodyDefinition(),
            fixtureDefinition: new box2d.FixtureDefinition({shape:new box2d.CircleShape(0.25)})});
          physicsBody.tankBulletCollisions = 0;
          var newBullet = new Entity("bullet",
            [
              new engine.core.Transform(space.findNamed ("tank-barrel").findComponent( "Transform").toWorldPoint()),
              new cubicvr.Model(resources.bullet, resources.bulletMaterial),
              physicsBody
            ]
          );
          physicsBody.onContactBegin = function(event){
            this.tankBulletCollisions++;
            if (this.tankBulletCollisions === 5){
              //This is how you remove something from the space properly
              this.owner.setActive(false);
              space.remove(this.owner);
            }
          };
          space.add(newBullet);
          var bulletVelocity = [3,0,0];
          space.findNamed("tank-barrel").findComponent( "Transform").directionToWorld(bulletVelocity, bulletVelocity);
          var impEvent = new engine.Event('LinearImpulse',{impulse: [bulletVelocity[0], bulletVelocity[2]]});
          impEvent.dispatch(newBullet);
        }
      }
    };

    function createTank(name, position, material, hasControls) {
// This parent entity will let us adjust the position and orientation of the
      // tank, and handle game logic events
      space.add(new Entity(name,
        [
          new engine.core.Transform(position, [math.TAU / 4, 0, 0], [0.5, 0.5, 0.5]),
          new engine.logic.Actor(tankLogic)
        ],
        [name]
      ));
      if (hasControls){
        space.findNamed(name).addComponent(new input.Controller(resources.tankControls));
      }
      space.add(new Entity(name + "-body",
        [
          new engine.core.Transform(),
          new cubicvr.Model(resources.tankBody, material)
        ],
        [name],
        space.findNamed(name)
      ));
      space.add(new Entity(name + "-tread",
        [
          new engine.core.Transform([0, 0.8, 0]),
          new cubicvr.Model(resources.tankTread, material)
        ],
        [name],
        space.findNamed(name + "-body")
      ));
      space.add(new Entity(name + "-tread",
        [
          new engine.core.Transform([0, -0.8, 0]),
          new cubicvr.Model(resources.tankTread, material)
        ],
        [name],
        space.findNamed(name + "-body")
      ));
      space.add(new Entity(name+"-turret",
        [
          new engine.core.Transform([-0.2, 0, -0.6]),
          new cubicvr.Model(resources.tankTurret, material)
        ],
        [name],
        space.findNamed(name + "-body")
      ));
      space.add(new Entity(name + "-barrel",
        [
          new engine.core.Transform([0.8, 0, 0]),
          new cubicvr.Model(resources.tankBarrel, material)
        ],
        [name],
        space.findNamed(name + "-turret")
      ));
    }
    createTank("tank", [-4,0,-4], resources.material, true);
    createTank("red-tank", [4,0,4], resources.redMaterial, false);

    //TODO: Make these walls have tiling textures
    //TODO: Add in physics bounding boxes for them
    var bodyDefinition = new box2d.BodyDefinition({type:box2d.BodyDefinition.BodyTypes.STATIC});
    var fixtureDefinition = new box2d.FixtureDefinition({shape:new box2d.BoxShape(10,1)});

    var body = new box2d.Body({bodyDefinition: bodyDefinition, fixtureDefinition: fixtureDefinition});

    space.add( new Entity( "wallLeft",
      [
        new engine.core.Transform([-5,0,0], [0,math.TAU/4,0]),
        new cubicvr.Model(resources.wall, resources.wallMaterial),
        new box2d.Body({bodyDefinition: bodyDefinition, fixtureDefinition: fixtureDefinition})
      ]
    ));
    space.add( new Entity( "wallRight",
      [
        new engine.core.Transform([5,0,0], [0,math.TAU/4,0]),
        new cubicvr.Model(resources.wall, resources.wallMaterial),
        new box2d.Body({bodyDefinition: bodyDefinition, fixtureDefinition: fixtureDefinition})
      ]
    ));
    space.add( new Entity( "wallTop",
      [
        new engine.core.Transform([0,0,-5], [0,0,0]),
        new cubicvr.Model(resources.wall, resources.wallMaterial),
        new box2d.Body({bodyDefinition: bodyDefinition, fixtureDefinition: fixtureDefinition})
      ]
    ));
    space.add( new Entity( "wallBottom",
      [
        new engine.core.Transform([0,0,5], [0,0,0]),
        new cubicvr.Model(resources.wall, resources.wallMaterial),
        new box2d.Body({bodyDefinition: bodyDefinition, fixtureDefinition: fixtureDefinition})
      ]
    ));

    space.add( new Entity( "camera",
      [
        new engine.core.Transform( [0, 10, 0], [-math.TAU/4, 0, 0] ),
        new cubicvr.Camera(),
        new cubicvr.Light(lightDefinition)
      ]
    ));
    // space.findNamed( "camera" ).findComponent( "Camera" ).setTarget( 0, 0, 0 );

    engine.resume();
  }

});

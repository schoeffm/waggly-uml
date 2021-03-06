[![Build Status](https://travis-ci.org/schoeffm/waggly-uml.svg?branch=master)](https://travis-ci.org/schoeffm/waggly-uml)
[![npm version](https://badge.fury.io/js/wuml.svg)](http://badge.fury.io/js/wuml)
[![License MIT](https://img.shields.io/badge/license-MIT-brightgreen.svg)](https://img.shields.io/badge/license-MIT-brightgreen.svg)

wuml
=============

# Description

`wuml` is a [NodeJS][nodejs] based command line tool which is inspired by tools like [yuml][yuml] and based on the excellent work of [scruffy][scruffy]. It's built on top of `wsvg` (see [npm entry][wsvg_npm] or [github repo][wsvg_github] for further information) in order to create hand-drawn looking UML-diagrams whereas the input is provided in a simple ascii-format.

So as an example - it converts input like this:

```
[<<VaadinUI>>;MainUI|init(){bg:cornsilk}]-creates>[Menu|selectMenuItem(){bg:cornsilk}]                                     
                                                                                                                           
[<<Interface>>;ViewChangeListener|+beforeViewChange(ViewChangeEvent event);+afterViewChange(ViewChangeEvent event){bg:cornsilk}]^-.-adjust\nURI[<<VaadinUI>>;MainUI{bg:yellow}]
[<<Interface>>;Menu.MenuElementChangedListener|+handle(MenuElementChangedEvent event){bg:cornsilk}]^-.-switch\nContent[<<VaadinUI>>;MainUI]
[<<Interface>>;Menu.MenuElementChangedListener|+handle(MenuElementChangedEvent event)]<notifies-[Menu]                     
                                                                                                                           
[<<VaadinUI>>;MainUI]-creates>[WelcomeMainView{bg:lightgrey}]                                                              
[<<VaadinUI>>;MainUI]-creates>[TextSearchMainView{bg:lightgrey}]                                                           
[<<VaadinUI>>;MainUI]-creates>[GroupMainView{bg:lightgrey}]                                                                
[<<VaadinUI>>;MainUI]-uses>[MainLayout|{bg:cornsilk}]
```
into class-diagrams like that:

![Example](https://github.com/schoeffm/waggly-uml/blob/master/doc/example.png)


another example would be this sequence diagram input

```
[t:thread]-run()>[:Toolkit]
[:Toolkit]-callbackLoop()>[:Toolkit]
[:Toolkit]-create>[p:Peer]
[:Toolkit]-handleExpose()>[p:Peer]
[p:Peer]-.->[:Toolkit]
[:Toolkit]-destroy>[p:Peer]
```

which gets converted to:

![Example2](https://github.com/schoeffm/waggly-uml/blob/master/doc/example.2.png)


# Installation / Usage

### CLI tool

Like [wsvg][wsvg_github], `wuml` provides a command line interface as well as the possibility to `require` it as an inline module in your node project (_in any case be sure to check the 
prerequisites_)

To install `wuml` from npm, run:

```
$ npm install -g wuml
```

After that you should be able to call the tool:

```
$ wuml --help

  Usage: wuml [options]

  Options:

    -h, --help                   output usage information
    -V, --version                output the version number
    -p, --png                    Export to PNG
    -t, --type [class|sequence]  Determines the graph-type to be created based on the given input (default is 'class')
    -c, --content <content>      UML-image content as input-string
    -i, --input <path>           Input UML description file
    -o, --output <path>          Filename for the output diagram file
    -w, --waggly                 Turns on the waggly-mode
    --fontFamily <font>          Set the output font-family (i.e. Purisa or Dadhand)
    --fontSize <size>            Set the size of the font to be used
```

_Notice_: `fontFamily` depends on the locally available fonts - so don't be disappointed, if there is no waggly font. Just check the font you've used.


### node module

You can also embed the tool in your own project. All you'll have to do is to install it as a dependency like i.e.:
```
$ npm install --save wuml
```

Afterwards you should be able to require the tool using:

```
var wuml = require('./wuml');

var config = {
	waggly: true,
	type: 'class',
	fontFamily: 'Purisa',
	fontSize: 10
};

wuml.createDiagram('[Customer|+name;+age]', config, function(resultingDiagramAsSVG) {
	console.log(resultingDiagramAsSVG);
});
```

The module exposes one factory-method which returns the actual transformer based on the given configuration. 

# Prerequisites

In order to use the tool you'll have to install at least two additional dependencies - `graphviz`, `rsvg-converter` and `plotutils` (the installation of additional, hand-written looking fonts is up to your taste).

## MacOS

On Mac you can install both tools via [homebrew][brew]

- ```brew install graphviz```
- ```brew install librsvg```
- ```brew install plotutils```

After that the upper mentioned `npm install wuml -g` should be enough to get started.


## Linux

Well, depending on the specific distribution you use the packages may differ as well as the syntax to install 'em. On Ubuntu/Debian you can install the necessary dependencies with:

```
apt-get update
apt-get install -y librsvg2-bin graphviz plotutils
```

## others

Well - there's also a `Dockerfile` contained in the git-repo you can use to get started. Just change into the folder, build the image and run it:

```
$ docker build -t="schoeffm/wuml" .
$ docker run --rm -ti schoeffm/wuml -h
Usage: wuml [options]

Options:
  -V, --version                        output the version number
  -f, --format [svg|png|jpg]           Optional: Determine your prefered output format (default is 'svg')
  -t, --type [class|sequence|usecase]  Determines the graph-type to be created based on the given input (default is 'class')
  -c, --content <content>              UML-image content as input-string
  -i, --input <path>                   Input UML description file
  -o, --output <path>                  Filename for the output diagram file
  -O, --orientation [LR|TD]            Optional: Orientation (Left-To-Right or Top-Down) (default will be determined automatically)
  -S, --splines [ortho|spline]         Optional: What kind of associations will be drawn (default is 'spline')
  -w, --waggly                         Turns on the waggly-mode
  --fontFamily <font>                  Set the output font-family (i.e. Purisa or Dadhand)
  --fontSize <size>                    Set the size of the font to be used
  -h, --help                           output usage information
    
$ docker run --rm -ti -v /absolue/path/to/test/data:/data schoeffm/wuml -i /data/input.wuml -o /data/output.png -w --fontFamily Purisa`
```



[nodejs]:https://nodejs.org
[wsvg_npm]:https://www.npmjs.com/package/wsvg
[wsvg_github]:https://github.com/schoeffm/waggly-svg
[scruffy]:https://github.com/aivarsk/scruffy
[yuml]:http://yuml.me
[graphviz]:http://www.graphviz.org
[brew]:http://brew.sh

# Languator

Aims to help with **English synonyms**, derived words, autosuggestion and spelling **easily** and **efficiently**.

[Demonstration](http://languator.cilf.cz)

## Features

* Autosuggests words as you type.
* Offers synonyms for every word you type.
* Checks spelling.
* Helps with irregular verbs.
* Shows derived words.
* Lists the prepositions for phrasal verbs.
 

## But Whyyyy

I created the tool in **May 2011** as a programming part of my [bachelor's thesis](https://dip.felk.cvut.cz/browse/pdfcache/polcama1_2011bach.pdf).

## And how?

 * Firstly, there was some **data mining** needed to do. I took [wiktionary](http://en.wiktionary.org/) xml source and grabbed all the useful information I could and saved it to **PostgreSQL** database. Then I ran the parsing script again with wikipedia xml source to get the frequency of each word to be able to provide **most relevant** suggesting.

 * Secondly, I used **JettyServer** as a HTTP Server for exposing couple REST APIs to serve data from the database, [Hunspell](http://hunspell.sourceforge.net/) **spell checker** and [WordNet](http://wordnet.princeton.edu/wordnet/) **lexical database**.

    ##### List of APIs:  

    * /api/suggest - PostgreSQL database with datamined words
    * /api/synonyms - WordNet lexical database
    * /api/derivedwords - PostgreSQL database with datamined words
    * /api/misspelled - Hunspell spell checker
    * /api/irregularverbs - PostgreSQL database with contents grabbed from [wiktionary irregular verbs](http://en.wiktionary.org/wiki/Appendix:English_irregular_verbs)

 * The frontend **JavaScript** tool was the last thing remaining to implement. I took advantage of jQuery framework and it's UI plugins.

## Is it awesome?
Of course. [Give it a try](http://languator.cilf.cz/)!

Marek Polcar, 2011, [cilf.cz](http://cilf.cz)

The source code is licensed under [New BSD License](https://github.com/cilf/languator/blob/master/license.md).